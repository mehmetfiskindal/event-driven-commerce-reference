Proje fikri

Event-driven mini e-commerce / order processing backend

Not:

Bu repo bir public demo/portfolio projesidir. Amaç ürün çıkarmak değil, event-driven backend kavramlarını temiz ve anlaşılır bir şekilde göstermektir.

Bu yüzden:

* demo için gerekli parçalar yapılır
* ürün seviyesine taşıyan ileri operasyonel özellikler bilinçli olarak repo kapsamı dışında bırakılır
* birinin bu repoyu ürünleştirmek istemesi halinde ayrıca mimari ve operasyonel emek harcaması gerekir

Ne yapar?

Bir müşteri sipariş oluşturur.
API siparişi veritabanına yazar ve bir event yayınlar.
Sonra farklı servisler bu event’i işler:

Order Service → sipariş oluşturur
Payment Service → ödeme sonucu üretir
Inventory Service → stok düşer
Notification Service → kullanıcıya bildirim event’i üretir
Shipping Service → kargo hazırlanır
Dead Letter / Retry Worker → başarısız işleri yönetir

Mimari

En iyi başlangıç yapısı şu olur:

apps/api-gateway → REST API
apps/order-service
apps/payment-worker
apps/inventory-worker
apps/notification-worker
apps/shared → event contract, aws client config, logger

Akış şöyle olabilir:

POST /orders
API order kaydını oluşturur
OrderCreated event’i SNS topic’e publish edilir
SNS bunu birden çok SQS queue’ya fan-out eder
Payment, inventory, notification worker’ları kendi queue’larından tüketir
Bir worker hata alırsa mesaj retry olur
Belirli sayıda hata sonrası DLQ’ya düşer

SNS’nin SQS ile birlikte kullanılabildiğini LocalStack dokümanları da doğrudan gösteriyor; AWS’nin JS v3 örnekleri de topic oluşturma, queue aboneliği ve publish/poll senaryolarını kapsıyor.


Bu projeyi 3 aşamada yap:

1. MVP
order create endpoint
SNS topic: order-events
SQS queues:
payment-queue
inventory-queue
notification-queue
worker’lar queue consume etsin
basit PostgreSQL veya SQLite
LocalStack üzerinden topic/queue create

2. Orta seviye
DLQ ekle
retry count
message attributes
idempotency key
request tracing
health check endpoint
docker compose ile tek komut ayağa kalksın

LocalStack’in SQS dökümanında DLQ ve redrive akışı örneklenmiş; bu yüzden localde bunu gerçekçi şekilde deneyebilirsin.

3. Güzel public demo seviyesi
Swagger / OpenAPI
seed script
integration test
README’de mimari diyagram
örnek event payload’ları
temiz Docker setup


Bu repo kapsamında özellikle yapılmayacak veya opsiyonel bırakılacak şeyler:

* outbox pattern
* poison message replay arayüzleri
* ileri observability altyapısı
* failure simulation mode
* production deployment akışı
* güvenlik ve compliance sertleştirmesi
