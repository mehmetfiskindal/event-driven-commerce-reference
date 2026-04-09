# Event-Driven Order Processing System — Event Contract Dokümanı

## 1. Amaç

Bu doküman, sistemde yayınlanan domain event'lerin ortak zarf yapısını ve payload alanlarını tanımlar.

Amaç:

* producer ve consumer servisler arasında net bir sözleşme oluşturmak
* event payload'larının versiyonlanabilir ve doğrulanabilir olmasını sağlamak
* worker implementasyonları için referans bir kaynak sunmak

Not:

Bu contract'lar demo seviyesinde anlaşılır ve stabil kalması için sade tutulur. Kurumsal ürünlerde görülen ileri seviye schema governance süreçleri bu repo kapsamına dahil değildir.

---

## 2. Ortak Event Envelope

Sistemde tüm event'ler ortak bir envelope yapısı ile publish edilir.

Önerilen temel yapı:

```json
{
  "eventType": "OrderCreated",
  "eventVersion": 1,
  "payload": {},
  "metadata": {
    "eventId": "evt-7b2b3c8a",
    "requestId": "req-123",
    "correlationId": "corr-456",
    "idempotencyKey": "idem-789",
    "source": "order-service",
    "createdAt": "2026-04-09T13:00:00Z"
  }
}
```

Alanlar:

* `eventType`: event adı
* `eventVersion`: contract versiyonu
* `payload`: business data
* `metadata.eventId`: event'in benzersiz kimliği
* `metadata.requestId`: HTTP request veya çağrı izleme kimliği
* `metadata.correlationId`: bir iş akışı boyunca taşınan ortak kimlik
* `metadata.idempotencyKey`: tekrar işleme kontrolü için anahtar
* `metadata.source`: event'i üreten servis
* `metadata.createdAt`: event oluşturulma zamanı

---

## 3. Ortak Tipler

Bu alanlar birden fazla event içinde tekrar eder.

### 3.1 Order item

```json
{
  "productId": "p-10",
  "quantity": 2,
  "unitPrice": 120
}
```

### 3.2 Money alanları

Parasal değerlerde aşağıdaki yaklaşım önerilir:

* `amount`: numeric değer
* `currency`: ISO para birimi kodu

İlk aşamada `number` kullanılabilir. Daha ileri aşamada hassasiyet için minor unit veya string decimal formata geçilebilir.

---

## 4. Event Contract'ları

### 4.1 `OrderCreated`

Bu event, sipariş başarıyla oluşturulduğunda yayınlanır.

Producer:

* `order-service`

Consumer örnekleri:

* `payment-worker`
* `inventory-worker`
* `notification-worker`

Payload yapısı:

```json
{
  "orderId": "ord-5001",
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
  "totalAmount": 320,
  "currency": "TRY",
  "status": "CREATED"
}
```

Alanlar:

* `orderId`: sipariş kimliği
* `userId`: siparişi veren kullanıcı
* `items`: sipariş kalemleri
* `totalAmount`: sipariş toplam tutarı
* `currency`: para birimi
* `status`: sipariş durumu

---

### 4.2 `PaymentCompleted`

Bu event, ödeme başarıyla tamamlandığında yayınlanır.

Producer:

* `payment-worker`

Consumer örnekleri:

* `notification-worker`
* ileride `shipping-worker`

Payload yapısı:

```json
{
  "orderId": "ord-5001",
  "paymentId": "pay-9001",
  "userId": "u-1001",
  "amount": 320,
  "currency": "TRY",
  "status": "COMPLETED",
  "processedAt": "2026-04-09T13:01:00Z",
  "provider": "mock-gateway"
}
```

Alanlar:

* `orderId`: ilgili sipariş
* `paymentId`: ödeme işlem kimliği
* `userId`: kullanıcı kimliği
* `amount`: tahsil edilen tutar
* `currency`: para birimi
* `status`: ödeme durumu
* `processedAt`: ödeme tamamlama zamanı
* `provider`: ödeme sağlayıcısı veya mock servis adı

---

### 4.3 `PaymentFailed`

Bu event, ödeme başarısız olduğunda yayınlanır.

Producer:

* `payment-worker`

Consumer örnekleri:

* `notification-worker`
* ileride `order-service` veya compensating workflow

Payload yapısı:

```json
{
  "orderId": "ord-5001",
  "paymentId": "pay-9001",
  "userId": "u-1001",
  "amount": 320,
  "currency": "TRY",
  "status": "FAILED",
  "reasonCode": "CARD_DECLINED",
  "reasonMessage": "Card was declined by issuer",
  "failedAt": "2026-04-09T13:01:00Z",
  "provider": "mock-gateway"
}
```

Alanlar:

* `orderId`: ilgili sipariş
* `paymentId`: ödeme işlem kimliği
* `userId`: kullanıcı kimliği
* `amount`: işlenmeye çalışılan tutar
* `currency`: para birimi
* `status`: ödeme durumu
* `reasonCode`: hata kodu
* `reasonMessage`: okunabilir hata açıklaması
* `failedAt`: hata zamanı
* `provider`: ödeme sağlayıcısı veya mock servis adı

---

### 4.4 `InventoryReserved`

Bu event, sipariş için gerekli stok ayrıldığında yayınlanır.

Producer:

* `inventory-worker`

Consumer örnekleri:

* `notification-worker`
* ileride `shipping-worker`

Payload yapısı:

```json
{
  "orderId": "ord-5001",
  "reservationId": "res-7001",
  "status": "RESERVED",
  "reservedItems": [
    {
      "productId": "p-10",
      "quantity": 2
    },
    {
      "productId": "p-11",
      "quantity": 1
    }
  ],
  "reservedAt": "2026-04-09T13:01:10Z"
}
```

Alanlar:

* `orderId`: ilgili sipariş
* `reservationId`: stok rezervasyon kimliği
* `status`: rezervasyon durumu
* `reservedItems`: ayrılan ürünler
* `reservedAt`: rezervasyon zamanı

---

### 4.5 `InventoryFailed`

Bu event, stok ayırma işlemi başarısız olduğunda yayınlanır.

Producer:

* `inventory-worker`

Consumer örnekleri:

* `notification-worker`
* ileride `order-service` veya cancellation flow

Payload yapısı:

```json
{
  "orderId": "ord-5001",
  "status": "FAILED",
  "failedItems": [
    {
      "productId": "p-10",
      "requestedQuantity": 2,
      "availableQuantity": 0
    }
  ],
  "reasonCode": "INSUFFICIENT_STOCK",
  "reasonMessage": "Not enough stock for one or more items",
  "failedAt": "2026-04-09T13:01:10Z"
}
```

Alanlar:

* `orderId`: ilgili sipariş
* `status`: stok işleme durumu
* `failedItems`: stok problemi yaşanan ürünler
* `reasonCode`: hata kodu
* `reasonMessage`: hata açıklaması
* `failedAt`: hata zamanı

---

### 4.6 `NotificationSent`

Bu event, kullanıcı bildirimi başarıyla gönderildiğinde yayınlanır.

Producer:

* `notification-worker`

Payload yapısı:

```json
{
  "orderId": "ord-5001",
  "userId": "u-1001",
  "notificationId": "ntf-3001",
  "channel": "EMAIL",
  "template": "order-created",
  "status": "SENT",
  "sentAt": "2026-04-09T13:01:30Z"
}
```

Alanlar:

* `orderId`: ilgili sipariş
* `userId`: kullanıcı kimliği
* `notificationId`: bildirim kimliği
* `channel`: bildirim kanalı
* `template`: kullanılan şablon
* `status`: bildirim durumu
* `sentAt`: gönderim zamanı

---

### 4.7 `NotificationFailed`

Bu event, bildirim gönderimi başarısız olduğunda yayınlanır.

Producer:

* `notification-worker`

Payload yapısı:

```json
{
  "orderId": "ord-5001",
  "userId": "u-1001",
  "notificationId": "ntf-3001",
  "channel": "EMAIL",
  "template": "order-created",
  "status": "FAILED",
  "reasonCode": "PROVIDER_TIMEOUT",
  "reasonMessage": "Notification provider timed out",
  "failedAt": "2026-04-09T13:01:30Z"
}
```

Alanlar:

* `orderId`: ilgili sipariş
* `userId`: kullanıcı kimliği
* `notificationId`: bildirim kimliği
* `channel`: bildirim kanalı
* `template`: kullanılan şablon
* `status`: bildirim durumu
* `reasonCode`: hata kodu
* `reasonMessage`: hata açıklaması
* `failedAt`: hata zamanı

---

## 5. Versiyonlama Kuralları

Event contract'ları zaman içinde değişebilir. Demo için basit bir versiyonlama kuralı yeterlidir.

Öneri:

* yeni zorunlu alan eklenirse `eventVersion` artırılır
* alan adı değiştirilirse yeni versiyon oluşturulur
* geriye dönük uyumlu opsiyonel alan eklemeleri aynı major akışta kalabilir
* consumer'lar `eventType` ve `eventVersion` birlikte kontrol etmelidir

Bu yaklaşım demo için yeterlidir. Merkezi schema registry, cross-team governance veya backward compatibility automation bu repo kapsamının dışındadır.

---

## 6. Doğrulama Kuralları

Consumer tarafında minimum şu kontroller yapılmalıdır:

* `eventType` beklenen değer mi
* `eventVersion` destekleniyor mu
* `metadata.eventId` mevcut mu
* `metadata.correlationId` mevcut mu
* payload içindeki zorunlu alanlar dolu mu

Bu yapı kod tarafında `zod` veya benzeri bir doğrulama katmanıyla kontrol edilebilir.

---

## 7. Uygulama Notları

Bu doküman başlangıç için yeterli ve pratiktir. Kod tarafında şu klasör yapısı önerilir:

```text
apps/shared/
  events/
    order-created.ts
    payment-completed.ts
    payment-failed.ts
    inventory-reserved.ts
    inventory-failed.ts
    notification-sent.ts
    notification-failed.ts
```

Her event için aşağıdaki parçalar tutulabilir:

* TypeScript type veya interface
* runtime validation schema
* serializer/deserializer helper
* örnek fixture payload
