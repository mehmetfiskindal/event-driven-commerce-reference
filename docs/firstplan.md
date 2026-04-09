# Event-Driven Order Processing System — Detaylı Geliştirme Planı

## 1. Amaç

Bu doküman, projedeki yüksek seviyeli fikri uygulanabilir bir geliştirme planına dönüştürür.

Referans aldığı dokümanlar:

* `docs/arch.md`
* `docs/flow.md`
* `docs/event-contracts.md`
* `docs/database.md`

Amaç:

* demo kapsamını netleştirmek
* geliştirme sırasını belirlemek
* her aşamanın somut çıktısını tanımlamak
* repo'nun gereksiz şekilde ürünleşmesini önlemek

---

## 2. Proje Özeti

Bu repo, public bir demo/portfolio projesidir.

Temel senaryo:

1. Client `POST /orders` çağrısı yapar.
2. API request'i doğrular.
3. Order verisi veritabanına yazılır.
4. `OrderCreated` event'i SNS topic'e publish edilir.
5. SQS üzerinden payment, inventory ve notification worker'ları bu event'i tüketir.
6. Her worker kendi sonucunu bağımsız üretir.

Bu proje bir ürün değildir.

Bu yüzden hedef:

* anlaşılır mimari
* temiz demo akışı
* tekrar kullanılabilir shared altyapı
* localde çalışabilen örnek sistem

Ürün seviyesinde beklenen ama bu repo için zorunlu olmayan şeyler:

* outbox/inbox pattern
* gerçek payment provider entegrasyonu
* ileri telemetry stack
* operasyon paneli
* replay araçları
* production deployment pipeline

---

## 3. Demo Kapsamı

Bu demo için çekirdek kapsam:

* tek giriş endpoint'i: `POST /orders`
* tek health endpoint'i: `GET /health`
* tek topic: `order-events`
* üç queue:
  * `payment-queue`
  * `inventory-queue`
  * `notification-queue`
* üç worker:
  * payment
  * inventory
  * notification
* PostgreSQL
* LocalStack
* Prisma
* Zod
* Swagger

Bu repo için bilinçli sınır:

* sadece local-first çalışma
* gerçek dış servisler yerine mock/simülasyon davranışı
* okunabilirlik ve öğreticilik odaklı kod

---

## 4. Uygulama Stratejisi

Kod tabanının mevcut durumu tek NestJS uygulaması olduğu için geliştirme şu sırayla yapılmalıdır:

1. önce modüler monolith yaklaşımı ile `src/` altında ilerlemek
2. ortak altyapıyı `shared` altında toplamak
3. order akışını uçtan uca çalıştırmak
4. worker akışlarını eklemek
5. demo cilasını tamamlamak

Bu yaklaşımın nedeni:

* erken aşamada gereksiz microservice karmaşıklığını önlemek
* akışı önce tek kod tabanında doğrulamak
* sonra istenirse `apps/` yapısına ayrılabilir hale gelmek

---

## 5. Aşama 0 — Temel Repo ve Shared Katman

Bu aşamanın amacı, tekrar kullanılabilir altyapıyı oluşturmaktır.

### Yapılacaklar

* environment validation
* AWS client config
* topic/queue constants
* event envelope yapısı
* event builder'lar
* publisher/consumer wrapper
* logger
* idempotency helper
* correlation/request id helper
* ortak error tipleri
* Docker ve LocalStack bootstrap

### Beklenen klasörler

```text
src/shared/
  aws/
  config/
  constants/
  errors/
  events/
  idempotency/
  logger/
  messaging/
  tracing/
  utils/
```

### Çıktılar

* tüm servislerin ortak kullanacağı teknik omurga oluşmuş olur
* event ve messaging tarafında string tekrarları önlenir
* sonraki modüller shared bağımlılıkları kullanarak yazılabilir

### Kabul kriterleri

* config tek bir yerden doğrulanıyor olmalı
* `OrderCreated` event'i kod tarafında üretilebiliyor olmalı
* SNS/SQS client oluşturma shared üzerinden yapılmalı
* shared kodlar business logic içermemeli

---

## 6. Aşama 1 — Veritabanı ve Order Persistence

Bu aşamanın amacı, `database.md` dokümanındaki çekirdek veri modelini uygulamaktır.

### Yapılacaklar

* Prisma kurulumu ve `schema.prisma`
* temel tabloların modellenmesi
* ilk migration
* Prisma client generate akışı
* order repository katmanı

### İlk iterasyonda zorunlu tablolar

* `orders`
* `order_items`
* `processed_events`

### İkinci iterasyonda eklenebilecek tablolar

* `payments`
* `inventory_reservations`
* `inventory_reservation_items`
* `notification_logs`

### Neden bu sırayla?

Çünkü ilk çalışan akış için önce order kaydının persist edilmesi gerekir. Payment, inventory ve notification sonuç tabloları daha sonra eklenebilir.

### Çıktılar

* order kayıtları kalıcı hale gelir
* request metadata veritabanında tutulur
* worker idempotency kayıtları için temel tablo hazır olur

### Kabul kriterleri

* migration localde çalışmalı
* order ve order item kayıtları tek akışta yazılabilmeli
* `correlation_id` ve `request_id` persist edilmeli

---

## 7. Aşama 2 — Order API

Bu aşamanın amacı, sistemin senkron giriş katmanını tamamlamaktır.

### Yapılacaklar

* `orders` modülü oluşturmak
* request schema'yı Zod ile tanımlamak
* `POST /orders` endpoint'ini eklemek
* toplam tutar hesaplaması
* order id üretimi
* basic response contract
* hata durumları için anlaşılır response'lar

### Önerilen modül yapısı

```text
src/modules/orders/
  orders.controller.ts
  orders.service.ts
  orders.repository.ts
  orders.schemas.ts
  orders.types.ts
```

### API request

`flow.md` ile uyumlu olarak:

```json
{
  "userId": "u-1001",
  "items": [
    {
      "productId": "p-10",
      "quantity": 2,
      "unitPrice": 120
    }
  ],
  "currency": "TRY"
}
```

### API response

İlk versiyon için:

```json
{
  "success": true,
  "orderId": "ord-5001",
  "status": "CREATED"
}
```

### Çıktılar

* sistemin giriş noktası oluşur
* order creation akışı senkron olarak çalışır
* validasyon ve domain hesaplamaları netleşir

### Kabul kriterleri

* geçerli request order oluşturmalı
* geçersiz request event üretmemeli
* Swagger'da endpoint görünmeli
* e2e test ile endpoint doğrulanmalı

---

## 8. Aşama 3 — `OrderCreated` Publish Akışı

Bu aşamanın amacı, order oluşturma ile event publish arasında bağlantı kurmaktır.

### Yapılacaklar

* `OrderCreated` payload mapping
* event metadata üretimi
* SNS publisher entegrasyonu
* publish logları
* publish başarısız olursa kontrollü hata davranışı

### Event içeriği

`event-contracts.md` ile uyumlu olmalı:

* `eventType`
* `eventVersion`
* `payload`
* `metadata.eventId`
* `metadata.requestId`
* `metadata.correlationId`
* `metadata.idempotencyKey`
* `metadata.source`
* `metadata.createdAt`

### Çıktılar

* order oluşturulduğunda fan-out akışı tetiklenebilir hale gelir
* worker tarafı için gerçek giriş event'i oluşur

### Kabul kriterleri

* başarılı order create sonrası SNS publish denenmeli
* publish edilen message contract'a uymalı
* `correlationId` request'ten event'e taşınmalı

---

## 9. Aşama 4 — Payment Worker

Bu aşamanın amacı, ilk asenkron worker'ı ayağa kaldırmaktır.

### Yapılacaklar

* payment consumer loop
* SQS message parse
* `OrderCreated` doğrulama
* mock payment sonucu üretme
* `payments` tablosuna yazma
* `PaymentCompleted` veya `PaymentFailed` event üretme
* processed event kaydı

### Basit demo davranışı

Örnek yaklaşım:

* belirli order id pattern'inde success
* belirli pattern'de fail
* dış provider yerine mock provider adı kullan

### Çıktılar

* sistemde ilk gerçek async business akışı görünür hale gelir
* payment sonucu bağımsız işlenir

### Kabul kriterleri

* aynı mesaj ikinci kez işlendiğinde duplicate etkisi oluşturmamalı
* payment sonucu DB'ye yazılmalı
* başarılı/başarısız durum loglanmalı

---

## 10. Aşama 5 — Inventory Worker

Bu aşamanın amacı, stok tarafını bağımsız bir worker olarak göstermektir.

### Yapılacaklar

* inventory consumer loop
* item bazlı stok kontrolü simülasyonu
* `inventory_reservations` tablosu
* `inventory_reservation_items` tablosu
* `InventoryReserved` veya `InventoryFailed` event üretimi
* processed event kaydı

### Basit demo davranışı

Örnek yaklaşım:

* bazı ürün id'leri başarılı rezervasyon döner
* bazı ürün id'leri yetersiz stok döner

### Çıktılar

* ikinci bağımsız worker akışı oluşur
* event-driven ayrışma daha görünür hale gelir

### Kabul kriterleri

* stok sonucu order create akışını bloklamamalı
* başarılı ve başarısız senaryolar ayrı loglanmalı
* reservation kayıtları DB'de görülebilmeli

---

## 11. Aşama 6 — Notification Worker

Bu aşamanın amacı, üçüncü bağımsız worker ile fan-out modelini tamamlamaktır.

### Yapılacaklar

* notification consumer loop
* order bilgisiyle bildirim içeriği üretme
* mock e-posta/push davranışı
* `notification_logs` tablosuna yazma
* `NotificationSent` veya `NotificationFailed` event üretimi

### Basit demo davranışı

* `EMAIL` default kanal olabilir
* gerçek provider entegrasyonu yapılmaz
* timeout veya template hatası simüle edilebilir

### Çıktılar

* tek bir `OrderCreated` event'inin üç ayrı consumer tarafından işlendiği gösterilir
* demo'nun event-driven karakteri görünür hale gelir

### Kabul kriterleri

* notification sonucu order akışından bağımsız işlenmeli
* log kaydı oluşmalı
* failure durumunda retry akışına uygun davranmalı

---

## 12. Aşama 7 — Retry, DLQ ve Idempotency

Bu aşamanın amacı, demoyu sadece çalışan değil, güvenilir görünen bir yapıya taşımaktır.

### Yapılacaklar

* queue redrive policy
* her queue için DLQ
* retryable ve non-retryable error ayrımı
* processed event kaydı üzerinden duplicate koruması
* attempt loglama

### Minimum hedef

* retry davranışını göstermek
* duplicate message riskini göstermek
* DLQ'ya düşen mesajı log seviyesinde görünür kılmak

### Özellikle yapılmayacaklar

* manuel replay arayüzü
* gelişmiş operasyon paneli
* poison message yönetim UI'ı

### Kabul kriterleri

* bozuk mesaj veya kalıcı hata DLQ akışına gidebilmeli
* duplicate processing engellenmeli
* retry kararları error type üzerinden verilebilmeli

---

## 13. Aşama 8 — Health, Swagger ve Demo Cilası

Bu aşamanın amacı, repoyu kamuya açık bir demo olarak tamamlamaktır.

### Yapılacaklar

* `GET /health`
* Swagger bootstrap
* örnek request/response'lar
* seed script
* README güncellemeleri
* mimari diyagram
* örnek event payload'ları

### Çıktılar

* repo dışarıdan bakıldığında anlaşılır hale gelir
* demo'yu çalıştırmak ve incelemek kolaylaşır

### Kabul kriterleri

* Swagger localde açılmalı
* health endpoint çalışmalı
* README çalıştırma akışını net anlatmalı

---

## 14. Test Planı

Bu projede minimum test stratejisi şu olmalıdır:

### Unit test

* event builder testleri
* order total hesaplama testleri
* validation testleri
* idempotency helper testleri

### Integration test

* repository katmanı
* Prisma ile order persistence
* payment/inventory/notification result persistence

### E2E test

* `POST /orders`
* `GET /health`

Demo scope içinde test hedefi:

* az ama güven veren test seti
* ana akışların çalıştığını kanıtlayan testler

---

## 15. Önerilen Geliştirme Sırası

En mantıklı gerçek uygulama sırası:

1. shared katmanı bitir
2. Prisma schema ve migration ekle
3. orders modülünü yaz
4. `POST /orders` endpoint'ini çalıştır
5. `OrderCreated` publish et
6. payment worker ekle
7. inventory worker ekle
8. notification worker ekle
9. retry + DLQ + idempotency davranışını tamamla
10. Swagger, health, seed ve testlerle repoyu cilala

---

## 16. Milestone Tanımları

### Milestone 1 — Order Created Demo

İçerik:

* order endpoint çalışıyor
* order DB'ye yazılıyor
* `OrderCreated` publish ediliyor

Bu milestone, sistemin minimum değer üreten halidir.

### Milestone 2 — Full Fan-Out Demo

İçerik:

* payment worker çalışıyor
* inventory worker çalışıyor
* notification worker çalışıyor

Bu milestone, event-driven akışın en görünür halidir.

### Milestone 3 — Reliable Demo

İçerik:

* retry
* DLQ
* idempotency
* health
* Swagger

Bu milestone, repoyu güçlü bir portfolio demosu haline getirir.

---

## 17. Bu Repo İçin Özellikle Yapılmayacaklar

Bu planın dışında tutulacak veya opsiyonel bırakılacak başlıklar:

* outbox pattern
* inbox pattern
* saga orchestration
* gerçek payment gateway
* gerçek e-posta sağlayıcısı
* production deployment
* Kubernetes/Terraform katmanı
* ileri observability stack
* operasyon dashboard'u
* manuel replay aracı
* compliance ve security hardening programı

Bu başlıkların dışarıda bırakılması bilinçli bir tercihtir.

Amaç:

* repo'yu demo seviyesinde tutmak
* gereksiz ürün karmaşıklığını önlemek
* emek harcanmış ama scope'u kontrollü bir açık kaynak demo oluşturmak

---

## 18. Sonuç

Bu planla proje şu niteliklere sahip olur:

* event-driven akışı net gösteren
* localde çalışabilen
* dokümantasyonu güçlü
* veri modeli ve event contract'ı belirli
* public repo olarak anlaşılır
* demo sınırlarını aşmayan

Kısacası hedef, “küçük ama net anlatılmış bir event-driven backend demo” çıkarmaktır.
