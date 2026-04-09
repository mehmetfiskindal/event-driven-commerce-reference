# Event-Driven Order Processing System — Mimari Dokümanı

## 1. Amaç

Bu mimari, **event-driven** çalışan bir sipariş işleme sisteminin başlangıç seviyesinde temiz, anlaşılır ve geliştirilebilir şekilde kurulmasını amaçlar.

Bu repo için mimari hedef, ürün çıkarmak değil iyi anlatılmış bir demo oluşturmaktır.

Hedefler:

* servisleri sorumluluklarına göre ayırmak
* senkron bağımlılığı azaltmak
* RabbitMQ ile event-driven mantığını gerçek bir senaryo üzerinde öğrenmek
* Docker Compose ile tamamen local ortamda test edebilmek
* projeyi zamanla daha ileri seviye yapılara taşıyabilmek

Demo sınırı:

* local-first çalışmak
* temel event akışını göstermek
* servis ayrımını kavramsal olarak anlatmak
* repo'yu gereksiz ürün karmaşıklığına taşımamak

---

## 2. Yüksek Seviye Mimari

Sistem temel olarak iki parçadan oluşur:

1. **Senkron giriş katmanı**

   * istemciden HTTP isteği alır
   * siparişi veritabanına kaydeder
   * event yayınlar

2. **Asenkron işleyici katmanı**

   * yayınlanan event’leri kuyruklardan tüketir
   * kendi iş mantığını bağımsız yürütür
   * başarısız mesajları retry veya DLQ akışına bırakır

Genel akış:

```text
Client
  ↓
API Gateway
  ↓
Database
  ↓
RabbitMQ Exchange: order-events
  ↓
┌──────────────────────────────────────────────┐
│ payment-queue                               │
│ inventory-queue                             │
│ notification-queue                          │
└──────────────────────────────────────────────┘
  ↓                ↓                 ↓
Payment Worker   Inventory Worker   Notification Worker
```

---

## 3. Klasör ve Uygulama Yapısı

Önerilen başlangıç yapısı:

```text
apps/
  api-gateway/
  order-service/
  payment-worker/
  inventory-worker/
  notification-worker/
  shared/
```

Bu yapı monorepo mantığında düşünülmüştür. Her uygulama kendi sorumluluğuna sahiptir ama ortak kod tekrarını azaltmak için `shared` katmanını kullanır.

---

## 4. Bileşenler ve Sorumluluklar

### 4.1 `apps/api-gateway`

Bu servis sistemin dış dünyaya açılan HTTP kapısıdır.

Sorumlulukları:

* REST endpoint’lerini sunmak
* request validation yapmak
* istemciyi doğrulamak
* order oluşturma isteğini ilgili uygulama katmanına iletmek
* başarılı order oluşturma sonrası event publish etmek
* correlation id / request id üretmek

Bu katman mümkün olduğunca ince tutulmalıdır. Ağır iş mantığı burada birikmemelidir.

Örnek endpoint:

* `POST /orders`
* `GET /health`

---

### 4.2 `apps/order-service`

Bu servis siparişin çekirdek domain mantığını taşır.

Sorumlulukları:

* sipariş oluşturma kuralları
* sipariş verisinin persist edilmesi
* order aggregate mantığı
* event üretimi için payload hazırlama
* gerekiyorsa outbox kaydı oluşturma

Neden ayrı düşünülmeli:

* ileride `api-gateway` sadece transport katmanı kalır
* domain mantığı bağımsız test edilir
* farklı giriş noktaları eklenirse aynı servis tekrar kullanılabilir

Not:
Başlangıç aşamasında `order-service`, `api-gateway` içinde modül olarak da yaşayabilir. Ama mimari dokümanda ayrı servis gibi düşünmek ileride büyümeyi kolaylaştırır.

---

### 4.3 `apps/payment-worker`

Bu worker, `OrderCreated` event’ini dinler ve ödeme sürecini simüle eder ya da işler.

Sorumlulukları:

* `payment-queue` üzerinden mesaj tüketmek
* mesajı parse etmek
* ödeme sonucunu üretmek
* başarılıysa `PaymentCompleted` veya başarısızsa `PaymentFailed` gibi event üretmek
* tekrar işlenmeyi önlemek için idempotency kontrolü yapmak

Bu servis order oluşturma akışını bloklamaz. Yani kullanıcıya hızlı cevap döndürülür, ödeme işleme arka planda devam eder.

---

### 4.4 `apps/inventory-worker`

Bu worker stok yönetiminden sorumludur.

Sorumlulukları:

* `inventory-queue` üzerinden mesaj tüketmek
* sipariş edilen ürünlerin stoklarını düşmek
* stok yetersizliği durumunu işlemek
* gerekirse `InventoryReserved` veya `InventoryFailed` event’i üretmek

Bu servis izole tutulduğu için stok tarafındaki yük veya hata, notification gibi başka akışları doğrudan bozmaz.

---

### 4.5 `apps/notification-worker`

Bu worker kullanıcıya bilgi verme görevini üstlenir.

Sorumlulukları:

* `notification-queue` mesajlarını tüketmek
* e-posta, push ya da SMS benzeri notification akışını simüle etmek
* notification log kaydı tutmak
* başarısız bildirimlerde retry uygulamak

Bu worker çoğu zaman dış sistemlerle konuşan ilk parçalardan biri olur. Bu yüzden retry, timeout ve DLQ davranışları burada çok değerlidir.

---

### 4.6 `apps/shared`

Bu katman ortak kodların merkezi olur.

İçeriği:

* event contract’ları
* RabbitMQ connection config
* exchange/queue isimleri
* logger
* tracing/correlation yardımcıları
* ortak hata tipleri
* DTO ve schema’lar

Örnek alt yapı:

```text
apps/shared/
  events/
  messaging/
  logger/
  constants/
  utils/
```

Buradaki amaç tekrar eden kodu azaltmak ve servisler arasında tutarlı yapı kurmaktır.

---

## 5. Event Akışı

Temel senaryo `POST /orders` isteğiyle başlar.

### Adım adım akış

1. Client, `POST /orders` isteği gönderir.
2. `api-gateway` request’i validate eder.
3. `order-service` siparişi veritabanına yazar.
4. Sipariş oluşturulduktan sonra `OrderCreated` event’i hazırlanır.
5. Event, RabbitMQ üzerindeki `order-events` exchange’ine publish edilir.
6. RabbitMQ bu mesajı ilgili queue’lara fan-out eder.
7. Her worker kendi kuyruğundan mesajı bağımsız şekilde tüketir.
8. Başarılı işlenen mesaj queue’dan silinir.
9. Başarısız mesaj görünmezlik süresi sonunda tekrar denenir.
10. Retry sınırı aşılırsa mesaj DLQ’ya gider.

Bu yapı sayesinde payment tarafı yavaşlasa bile inventory veya notification akışı çalışmaya devam edebilir.

---

## 6. Neden RabbitMQ?

Bu mimaride RabbitMQ kullanılmasının nedeni hem **publish/subscribe** hem de **dayanıklı queue processing** ihtiyacını tek broker içinde sade şekilde çözmesidir.

### RabbitMQ ne sağlar?

* tek event’i birden fazla queue’ya fan-out etme
* publish eden servisin tüketicileri bilmemesi
* durable queue ve ack/nack ile dayanıklı işleme
* retry ve DLQ davranışını queue tabanlı modelleme
* local geliştirmede düşük sürtünme

Bu yaklaşım fan-out + bağımsız işleme + hata toleransı için bu demo scope’unda yeterlidir.

---

## 7. Veri Akışı ve Tutarlılık

Sipariş verisi önce veritabanına yazılır, sonra event yayınlanır.

Burada dikkat edilmesi gereken konu şudur:

* veritabanı yazıldı ama event yayınlanamadıysa tutarsızlık oluşabilir

Bunu başlangıçta basit tutup daha sonra geliştirebilirsin.

### Başlangıç yaklaşımı

* önce order kaydı oluştur
* sonra event publish et
* publish hatası varsa logla ve manuel tekrar mekanizması düşün

### Ürünleştirme notu

* **Outbox Pattern** kullan
* event’i aynı transaction içinde outbox tablosuna yaz
* ayrı worker outbox’tan publish etsin

Bu yaklaşım bilerek ilk demo kapsamına dahil edilmez. Bu repoyu ürünleştirmek isteyen birinin ayrıca ele alması gereken konulardan biridir.

---

## 8. Hata Yönetimi

Asenkron sistemlerde hata yönetimi mimarinin merkezindedir.

### Hata tipleri

* geçici ağ hatası
* dış servis timeout
* bozuk mesaj formatı
* mantıksal iş kuralı hatası
* duplicate message

### Davranış

* geçici hata → retry
* kalıcı/zehirli mesaj → DLQ
* duplicate → idempotent olarak ignore et veya zaten işlendi diye işaretle

Bu yüzden worker tasarımları şu yeteneklere sahip olmalıdır:

* retry’a dayanıklı olmak
* aynı mesaj tekrar gelse de sistemi bozmamak
* gözlemlenebilir log üretmek

---

## 9. Idempotency

Message queue tabanlı sistemlerde aynı mesaj birden fazla kez gelebilir.

Bu normaldir. Bu yüzden consumer’lar idempotent olmalıdır.

Örnek:

* aynı `OrderCreated` mesajı iki kez işlendiğinde stok iki kez düşmemeli
* ödeme iki kez alınmamalı
* aynı notification iki kez gönderilmemeli

Çözüm yolları:

* `idempotencyKey` kullanmak
* işlenen message id’leri ayrı tabloda tutmak
* order bazlı state kontrolü yapmak

---

## 10. Loglama

Bu demo için temel loglama yeterlidir.

En azından şu bilgiler loglanmalıdır:

* request id
* correlation id
* event type
* order id
* queue name
* retry count
* worker sonucu

Amaç tam observability stack kurmak değil, akışın takip edilebilmesini sağlamaktır.

---

## 11. Sağlık Kontrolleri

Her servis minimum health endpoint’e sahip olmalıdır.

Örnek:

* `GET /health`

Kontrol edilebilecek şeyler:

* servis ayakta mı
* database erişimi var mı
* RabbitMQ erişimi var mı
* queue consumer loop aktif mi

Bu seviyede basit health endpoint yeterlidir. Orchestration veya gelişmiş runtime health stratejileri demo kapsamının dışındadır.

---

## 12. Genişlemeye Uygunluk

Bu mimari başlangıçta küçük olsa da büyümeye uygundur.

Sonradan eklenebilecek parçalar örnek olarak şunlardır:

* `shipping-worker`
* `analytics-worker`
* `fraud-check-worker`
* `invoice-worker`
* `webhook-worker`

Bu liste referans amaçlıdır. Demo kapsamı bu worker'ların uygulanmasını gerektirmez.

---

## 13. Çalıştırma Perspektifi

Başlangıçta tüm yapı localde docker compose ile çalıştırılabilir.

Tipik bileşenler:

* `rabbitmq:3-management`
* `postgres:16`
* Node.js servisleri

Yerel geliştirme aşamasında hedef:

* tüm sistemi tek komutla kaldırmak
* broker topology’sini uygulama başlarken veya publish öncesi oluşturmak
* worker’ların otomatik ayağa kalkması

Canlı ortam, cloud deployment, autoscaling ve production operasyonları bu dokümanın hedefi değildir.

---

## 14. Mimari Kararlar Özeti

### Bu mimaride neden ayrı worker’lar var?

Çünkü her iş akışı farklı hızda, farklı hata tipinde ve farklı ölçekleme ihtiyacında çalışır.

### Neden shared katmanı var?

Çünkü event contract, logger ve broker config gibi parçalar servisler arasında ortak ve tutarlı olmalıdır.

### Neden order-service ayrı düşünülüyor?

Çünkü HTTP katmanı ile domain mantığını ayırmak uzun vadede bakım kolaylığı sağlar.

### Neden doğrudan servisler birbirini çağırmıyor?

Çünkü event-driven yapıda gevşek bağlılık istenir. Producer, consumer’ı bilmeden event üretir.

---

## 15. Önerilen İlk Uygulama Sınırı

İlk versiyonda sistemi fazla büyütmeden şu kapsam yeterlidir:

* `api-gateway`
* `order-service`
* `payment-worker`
* `inventory-worker`
* `notification-worker`
* `shared`
* 1 RabbitMQ exchange
* 3 queue
* 3 DLQ
* PostgreSQL

Bu sınır hem öğrenmek hem de GitHub’da temiz bir repo çıkarmak için idealdir.

Ürünleştirme için ayrıca ele alınması gereken ama bu demo scope'una girmeyen başlıklar:

* outbox/inbox pattern
* ileri telemetry ve distributed tracing
* rollback/compensation akışlarının tam modellenmesi
* operasyonel replay araçları
* gerçek dış servis entegrasyonları
* güvenlik sertleştirmesi ve deployment pipeline'ı

---

## 16. Sonuç

Bu mimari, küçük bir demo olmaktan çıkıp gerçek dünyaya yakın bir backend sistemi kurmak için iyi bir temel sağlar.

Kazandırdığı başlıca konular:

* event-driven düşünme
* senkron ve asenkron akış ayrımı
* worker mantığı
* retry / DLQ tasarımı
* idempotent consumer geliştirme
* modüler Node.js servis mimarisi

Doğru kurulduğunda bu yapı hem öğretici olur hem de portföy için güçlü bir örnek projeye dönüşür.
