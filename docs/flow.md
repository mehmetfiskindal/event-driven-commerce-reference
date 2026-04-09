# Event-Driven Order Processing System — Akış Dokümanı

## 1. Amaç

Bu doküman, event-driven sipariş işleme sisteminde bir isteğin sisteme girişinden başlayıp ilgili worker’lar tarafından işlenmesine kadar geçen akışı anlatır.

Bu akış, public demo için tasarlanmıştır. Amaç temel event zincirini anlaşılır göstermek, tam ürün davranışını modellemek değildir.

Amaç:

* sistemin uçtan uca nasıl çalıştığını netleştirmek
* servislerin hangi sırayla devreye girdiğini göstermek
* hata, retry ve DLQ davranışlarını açıklamak
* geliştirme sırasında referans alınacak sade bir akış dokümanı sunmak

---

## 2. Genel Akış Özeti

Sistemin temel akışı şu şekildedir:

1. Client sipariş oluşturma isteği gönderir.
2. API Gateway isteği alır ve doğrular.
3. Order Service siparişi veritabanına kaydeder.
4. `OrderCreated` event’i oluşturulur.
5. Event, RabbitMQ exchange’ine publish edilir.
6. RabbitMQ event’i ilgili queue’lara fan-out eder.
7. Worker servisler kendi kuyruklarından mesajı tüketir.
8. Her worker kendi iş mantığını bağımsız yürütür.
9. Başarılı mesaj kuyruktan silinir.
10. Başarısız mesaj retry edilir.
11. Retry sınırı aşılırsa mesaj DLQ’ya taşınır.

---

## 3. Uçtan Uca Ana Senaryo

Aşağıdaki senaryo, sistemin en temel kullanımını anlatır.

### Adım 1 — Client sipariş oluşturur

İstemci şu endpoint’e istek atar:

```http
POST /orders
```

Örnek body:

```json
{
  "userId": "u-1001",
  "items": [
    {
      "productId": "p-10",
      "quantity": 2,
      "unitPrice": 120
    },
    {
      "productId": "p-11",
      "quantity": 1,
      "unitPrice": 80
    }
  ],
  "currency": "TRY"
}
```

Bu aşamada client yalnızca sipariş isteğini başlatır. Payment, inventory veya notification süreçlerinin tamamlanmasını beklemek zorunda değildir.

---

### Adım 2 — API Gateway request’i doğrular

`api-gateway` şu kontrolleri yapar:

* body formatı doğru mu
* gerekli alanlar dolu mu
* item listesi boş mu
* quantity ve price değerleri geçerli mi
* kullanıcı doğrulandı mı

Bu aşamada istek geçersizse sistem burada hata döner ve event üretmez.

---

### Adım 3 — Order Service siparişi oluşturur

Request geçerliyse `order-service` devreye girer.

Bu katman şunları yapar:

* order id üretir
* toplam tutarı hesaplar
* order kaydını veritabanına yazar
* başlangıç durumunu belirler

Örnek order durumu:

* `PENDING`
* `CREATED`

Bu aşamanın sonunda sistemde artık kalıcı bir order kaydı vardır.

---

### Adım 4 — `OrderCreated` event’i hazırlanır

Sipariş başarıyla oluşturulduktan sonra event payload hazırlanır.

Örnek:

```json
{
  "eventType": "OrderCreated",
  "eventVersion": 1,
  "payload": {
    "orderId": "ord-5001",
    "userId": "u-1001",
    "items": [
      { "productId": "p-10", "quantity": 2, "unitPrice": 120 },
      { "productId": "p-11", "quantity": 1, "unitPrice": 80 }
    ],
    "totalAmount": 320,
    "currency": "TRY",
    "status": "CREATED"
  },
  "metadata": {
    "requestId": "req-123",
    "correlationId": "corr-456",
    "idempotencyKey": "idem-789",
    "createdAt": "2026-04-09T13:00:00Z"
  }
}
```

Bu event, sistemin geri kalan parçaları için tetikleyici görevi görür.

---

### Adım 5 — Event RabbitMQ exchange’ine publish edilir

Hazırlanan event şu topic’e gönderilir:

* `order-events`

Burada producer yalnızca exchange’e mesaj bırakır. Payment veya inventory servisinin iç detaylarını bilmez.

Bu noktada gevşek bağlı mimari elde edilir.

---

### Adım 6 — RabbitMQ fan-out yapar

RabbitMQ, gelen `OrderCreated` event’ini bağlı kuyruklara dağıtır.

Örnek kuyruklar:

* `payment-queue`
* `inventory-queue`
* `notification-queue`

Sonuç olarak tek bir event, birden fazla bağımsız iş akışını tetikler.

---

## 4. Worker Akışları

Her worker kendi queue’sunu bağımsız tüketir.

### 4.1 Payment Worker akışı

`payment-worker`, `payment-queue` üzerinden mesajı alır.

Adımlar:

1. Mesajı queue’dan çeker.
2. Parse eder.
3. Mesaj tipinin `OrderCreated` olduğunu doğrular.
4. Order için ödeme işlemini simüle eder.
5. Sonucu loglar.
6. Başarılıysa mesajı siler.
7. İstenirse `PaymentCompleted` veya `PaymentFailed` event’i üretir.

Örnek sonuçlar:

* ödeme başarılı
* kart reddedildi
* dış servis timeout

---

### 4.2 Inventory Worker akışı

`inventory-worker`, `inventory-queue` mesajlarını işler.

Adımlar:

1. Mesajı alır.
2. Siparişteki ürünleri okur.
3. Stokları kontrol eder.
4. Uygunsa stok düşer.
5. Yetersiz stok varsa hata üretir veya ayrı event üretir.
6. Başarılıysa mesajı siler.

Olası sonuçlar:

* stok ayrıldı
* stok yetersiz
* ürün kaydı bulunamadı

---

### 4.3 Notification Worker akışı

`notification-worker`, `notification-queue` mesajlarını tüketir.

Adımlar:

1. Mesajı alır.
2. Kullanıcı bilgilerini ve order id’yi okur.
3. Gönderilecek bildirimi oluşturur.
4. Simüle edilmiş e-posta / push işlemini yapar.
5. Sonucu loglar.
6. Başarılıysa mesajı siler.

Olası sonuçlar:

* bildirim gönderildi
* dış servis cevap vermedi
* template hatası oluştu

---

## 5. Senkron ve Asenkron Ayrımı

Bu akışın önemli tarafı şudur:

### Senkron bölüm

* client isteği gönderir
* API request’i doğrular
* order veritabanına yazılır
* event publish edilir
* API response döner

### Asenkron bölüm

* payment işleme
* stok düşme
* bildirim gönderme
* ileri seviye ek servisler

Bu ayrım sayesinde istemci, tüm süreçlerin bitmesini beklemeden hızlı cevap alır.

---

## 6. API Response Davranışı

İlk versiyonda API genelde şu tarz bir response döner:

```json
{
  "success": true,
  "orderId": "ord-5001",
  "status": "CREATED"
}
```

Buradaki `CREATED` durumu, payment veya inventory işlemlerinin tamamen bittiği anlamına gelmez.

Bu sadece siparişin sisteme kabul edildiğini ve arka plan akışlarının başladığını gösterir.

---

## 7. Retry Akışı

Queue tabanlı sistemlerde bazı hatalar geçici olabilir. Örneğin:

* dış servise ulaşılamadı
* geçici veritabanı bağlantı sorunu
* timeout oluştu

Bu durumda worker mesajı silmez.

Sonuç:

* mesaj queue’da görünmez olur
* visibility timeout süresi dolunca tekrar görünür
* worker tekrar işlemeyi dener

Bu davranış retry mekanizmasını oluşturur.

---

## 8. DLQ Akışı

Bazı mesajlar sürekli hata üretebilir. Örneğin:

* bozuk JSON
* eksik alanlar
* mantıksal olarak işlenemeyecek veri
* sürekli hata veren poison message

Bu durumda aynı mesajı sonsuza kadar denemek doğru değildir.

Bu yüzden:

* mesaj belirli sayıda retry edilir
* eşik aşılırsa DLQ’ya taşınır

Örnek DLQ’lar:

* `payment-dlq`
* `inventory-dlq`
* `notification-dlq`

DLQ’daki mesajlar daha sonra incelenebilir veya loglanabilir.

Not:

manuel replay araçları ve operasyon panelleri bu demo kapsamına dahil değildir.

---

## 9. Idempotency Akışı

Aynı mesaj birden fazla kez işlenebilir. Bu durum queue sistemlerinde normaldir.

Örnek riskler:

* stok iki kez düşebilir
* ödeme iki kez alınabilir
* kullanıcı iki bildirim alabilir

Bu yüzden her worker şu kontrolleri yapmalıdır:

* bu message id daha önce işlendi mi
* bu order için aynı işlem zaten tamamlandı mı
* idempotency key mevcut mu

Gerekirse işlenen mesajlar ayrı tabloda tutulabilir.

---

## 10. Loglama Akışı

Her adımda log üretilmesi gerekir.

Önerilen log alanları:

* `requestId`
* `correlationId`
* `eventType`
* `orderId`
* `queueName`
* `consumerName`
* `attemptCount`
* `result`

Örnek log akışı:

1. request geldi
2. order oluşturuldu
3. event publish edildi
4. payment worker mesajı aldı
5. inventory worker mesajı aldı
6. notification worker mesajı aldı
7. payment başarılı / başarısız
8. inventory başarılı / başarısız
9. notification başarılı / başarısız

Bu yapı debugging’i ciddi şekilde kolaylaştırır.

---

## 11. Hata Senaryoları

### Senaryo A — Payment başarısız, inventory başarılı

Bu durumda:

* payment worker retry yapabilir
* inventory worker kendi akışını tamamlayabilir
* notification worker sipariş alındı bildirimi gönderebilir

Yani bir worker’daki sorun diğer worker’ları doğrudan durdurmaz.

### Senaryo B — Inventory sürekli hata veriyor

Bu durumda:

* inventory mesajı birkaç kez retry edilir
* sonra `inventory-dlq` içine taşınır
* diğer queue’lar çalışmaya devam eder

### Senaryo C — Notification dış servis timeout

Bu durumda:

* notification worker retry eder
* halen düzelmezse DLQ’ya gider

---

## 12. İleri Akışlar

İleride sisteme yeni worker’lar eklendiğinde akış bozulmadan büyüyebilir.

Örnekler:

* `shipping-worker`
* `invoice-worker`
* `analytics-worker`
* `fraud-check-worker`

Bu durumda mevcut producer aynı kalır. Sadece yeni queue ve yeni consumer eklenir.

Ancak bu bölüm yalnızca genişleme örneğidir; demo kapsamında bu worker'ların uygulanması beklenmez.

---

## 13. Basit Sıra Diyagramı

```text
Client
  │
  │ POST /orders
  ▼
API Gateway
  │ validate request
  ▼
Order Service
  │ save order to DB
  │ create OrderCreated event
  ▼
RabbitMQ: order-events
  ├──────────────► payment-queue ─────► payment-worker
  ├──────────────► inventory-queue ───► inventory-worker
  └──────────────► notification-queue ► notification-worker
```

---

## 14. Önerilen İlk Akış Sınırı

İlk versiyonda akış sade tutulmalıdır:

* tek endpoint: `POST /orders`
* tek topic: `order-events`
* üç queue: payment, inventory, notification
* üç worker
* her queue için bir DLQ
* basit loglama
* temel retry davranışı

Bu kapsam öğrenmek için yeterlidir ve sistemi gereksiz karmaşıklaştırmaz.

Bu demo bilinçli olarak şu alanlara girmez:

* manuel replay araçları
* gelişmiş operasyon dashboard'ları
* compensation akışlarının tam orkestrasyonu
* ürün seviyesi hata sınıflandırma ve runbook yapıları

---

## 15. Sonuç

Bu akış dokümanı, sistemin sipariş alımından worker işleyişine kadar olan tüm temel hareketini açıklar.

Ana fikir şudur:

* order işlemi sisteme hızlıca kabul edilir
* geri kalan iş yükü asenkron şekilde dağıtılır
* her worker bağımsız çalışır
* retry ve DLQ ile sistem dayanıklı hale gelir
* yeni servisler kolayca eklenebilir

Bu yaklaşım hem öğrenme hem de gerçek dünya backend mimarisi pratiği için güçlü bir temel sağlar.
