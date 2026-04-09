# Event-Driven Order Processing System — Veritabanı Dokümanı

## 1. Amaç

Bu doküman, projedeki mimari ve akış dokümanlarına göre veritabanında hangi tabloların bulunması gerektiğini ve bunların nasıl ilişkilendiğini tanımlar.

Amaç:

* sipariş akışını destekleyecek minimum veri modelini netleştirmek
* event-driven yapıda hangi verinin kalıcı tutulacağını belirlemek
* MVP ile ileri seviye yapı arasında geçişi kolaylaştırmak

Not:

Bu veri modeli demo için önerilen sade şemayı anlatır. Ürün seviyesinde görülebilecek bazı tablolar burada bilerek opsiyonel bırakılmıştır.

---

## 2. Genel Yaklaşım

Bu proje için başlangıçta tek bir ilişkisel veritabanı yeterlidir.

Öneri:

* ilk aşamada `PostgreSQL`
* çok hızlı prototip için alternatif olarak `SQLite`

Sistem event-driven olsa da başlangıçta servis başına ayrı veritabanı zorunlu değildir. Öğrenme ve MVP aşaması için ortak bir veritabanı daha pratiktir.

Başlangıç yaklaşımı:

* `order-service` sipariş verisini yazar
* worker'lar kendi iş sonuçlarını ilgili operasyon tablolarına yazar
* event payload'ları gerektiğinde debug amacıyla ayrıca saklanabilir

---

## 3. Tasarım İlkeleri

Bu proje için veri modelinde şu ilkeler önerilir:

* order verisi normalize ama sade tutulmalı
* event payload'ından tekrar üretilemeyecek operasyon sonuçları saklanmalı
* idempotency için benzersiz anahtarlar kullanılmalı
* audit ve debug için zaman alanları her tabloda bulunmalı
* ürünleşme için eklenebilecek yapılara kapı kapatılmamalı

---

## 4. Temel Tablolar

Başlangıç için önerilen temel tablolar:

* `orders`
* `order_items`
* `payments`
* `inventory_reservations`
* `inventory_reservation_items`
* `notification_logs`
* `processed_events`

Demo kapsamı dışında ama sonradan eklenebilecek tablolar:

* `outbox_events`
* `dead_letter_events`

---

## 5. Tablo Detayları

### 5.1 `orders`

Siparişin ana kaydı bu tabloda tutulur.

Önerilen alanlar:

* `id` `uuid` veya `varchar`
* `user_id`
* `status`
* `total_amount`
* `currency`
* `request_id`
* `correlation_id`
* `idempotency_key`
* `created_at`
* `updated_at`

Örnek status değerleri:

* `CREATED`
* `PENDING`
* `PAYMENT_COMPLETED`
* `PAYMENT_FAILED`
* `INVENTORY_RESERVED`
* `INVENTORY_FAILED`

Not:

Başlangıçta tek bir genel `status` alanı yeterlidir. İleride payment ve inventory için ayrı state alanları eklenebilir.

Örnek SQL:

```sql
create table orders (
  id varchar(64) primary key,
  user_id varchar(64) not null,
  status varchar(32) not null,
  total_amount numeric(12,2) not null,
  currency varchar(8) not null,
  request_id varchar(64),
  correlation_id varchar(64) not null,
  idempotency_key varchar(128),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

---

### 5.2 `order_items`

Siparişteki ürün kalemleri bu tabloda tutulur.

Önerilen alanlar:

* `id`
* `order_id`
* `product_id`
* `quantity`
* `unit_price`
* `line_total`
* `created_at`

İlişki:

* bir `orders` kaydının birden çok `order_items` kaydı olur

Örnek SQL:

```sql
create table order_items (
  id bigserial primary key,
  order_id varchar(64) not null references orders(id) on delete cascade,
  product_id varchar(64) not null,
  quantity integer not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  created_at timestamptz not null default now()
);
```

---

### 5.3 `payments`

Payment worker tarafından üretilen ödeme sonucu burada tutulur.

Önerilen alanlar:

* `id`
* `order_id`
* `user_id`
* `provider`
* `amount`
* `currency`
* `status`
* `reason_code`
* `reason_message`
* `processed_at`
* `created_at`
* `updated_at`

Örnek status değerleri:

* `COMPLETED`
* `FAILED`

Not:

Bir sipariş için başlangıçta tek ödeme kaydı varsayılabilir. İleride retry veya çoklu deneme olacaksa `attempt_no` alanı eklenebilir.

Örnek SQL:

```sql
create table payments (
  id varchar(64) primary key,
  order_id varchar(64) not null references orders(id),
  user_id varchar(64) not null,
  provider varchar(64) not null,
  amount numeric(12,2) not null,
  currency varchar(8) not null,
  status varchar(32) not null,
  reason_code varchar(64),
  reason_message text,
  processed_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);
```

---

### 5.4 `inventory_reservations`

Inventory worker'ın sipariş bazlı stok sonucu burada tutulur.

Önerilen alanlar:

* `id`
* `order_id`
* `status`
* `reason_code`
* `reason_message`
* `reserved_at`
* `failed_at`
* `created_at`
* `updated_at`

Örnek status değerleri:

* `RESERVED`
* `FAILED`

Örnek SQL:

```sql
create table inventory_reservations (
  id varchar(64) primary key,
  order_id varchar(64) not null references orders(id),
  status varchar(32) not null,
  reason_code varchar(64),
  reason_message text,
  reserved_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);
```

---

### 5.5 `inventory_reservation_items`

Hangi ürün için ne kadar stok ayrıldığı veya hangi ürünün başarısız olduğu bu tabloda tutulur.

Önerilen alanlar:

* `id`
* `reservation_id`
* `product_id`
* `requested_quantity`
* `reserved_quantity`
* `available_quantity`
* `created_at`

Not:

Başarılı durumda `reserved_quantity`, başarısız durumda `available_quantity` daha anlamlı olur. Tek tablo ile iki senaryo da taşınabilir.

Örnek SQL:

```sql
create table inventory_reservation_items (
  id bigserial primary key,
  reservation_id varchar(64) not null references inventory_reservations(id) on delete cascade,
  product_id varchar(64) not null,
  requested_quantity integer not null,
  reserved_quantity integer,
  available_quantity integer,
  created_at timestamptz not null default now()
);
```

---

### 5.6 `notification_logs`

Notification worker tarafından gönderilen veya başarısız olan bildirimler burada tutulur.

Önerilen alanlar:

* `id`
* `order_id`
* `user_id`
* `channel`
* `template`
* `status`
* `reason_code`
* `reason_message`
* `sent_at`
* `failed_at`
* `created_at`

Örnek status değerleri:

* `SENT`
* `FAILED`

Örnek SQL:

```sql
create table notification_logs (
  id varchar(64) primary key,
  order_id varchar(64) not null references orders(id),
  user_id varchar(64) not null,
  channel varchar(32) not null,
  template varchar(128) not null,
  status varchar(32) not null,
  reason_code varchar(64),
  reason_message text,
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now()
);
```

---

### 5.7 `processed_events`

Worker tarafında idempotency için işlenen event kayıtları burada tutulur.

Amaç:

* aynı event'in tekrar işlenmesini önlemek
* retry ile gelen duplicate mesajları tespit etmek

Önerilen alanlar:

* `id`
* `event_id`
* `event_type`
* `consumer_name`
* `correlation_id`
* `processed_at`

Örnek SQL:

```sql
create table processed_events (
  id bigserial primary key,
  event_id varchar(64) not null,
  event_type varchar(64) not null,
  consumer_name varchar(64) not null,
  correlation_id varchar(64),
  processed_at timestamptz not null default now(),
  unique (event_id, consumer_name)
);
```

---

## 6. Demo Dışı Opsiyonel Tablolar

### 6.1 `outbox_events`

Bu tablo demo için zorunlu değildir.

Amaç:

* order kaydı ile event oluşturmayı aynı transaction içinde güvenceye almak
* publish başarısız olsa bile event'i kaybetmemek

Önerilen alanlar:

* `id`
* `aggregate_type`
* `aggregate_id`
* `event_type`
* `event_version`
* `payload_json`
* `metadata_json`
* `status`
* `published_at`
* `created_at`

Örnek status değerleri:

* `PENDING`
* `PUBLISHED`
* `FAILED`

---

### 6.2 `dead_letter_events`

Bu tablo demo için zorunlu değildir.

Amaç:

* hata kayıtlarını ayrı incelemek
* DLQ mesajlarını uygulama verisinden ayırmak

Önerilen alanlar:

* `id`
* `event_id`
* `event_type`
* `consumer_name`
* `payload_json`
* `error_message`
* `retry_count`
* `moved_to_dlq_at`

---

## 7. İlişkiler

Temel ilişki yapısı:

```text
orders
  └── order_items

orders
  └── payments

orders
  └── inventory_reservations
        └── inventory_reservation_items

orders
  └── notification_logs
```

Bu model başlangıçta yeterince sade, fakat event-driven akışların sonucunu saklayacak kadar da açıklayıcıdır.

---

## 8. Önerilen İndeksler

Başlangıç için şu indeksler önerilir:

* `orders(user_id)`
* `orders(correlation_id)`
* `orders(created_at)`
* `payments(order_id)`
* `inventory_reservations(order_id)`
* `notification_logs(order_id)`
* `processed_events(event_id, consumer_name)`

Örnek:

```sql
create index idx_orders_user_id on orders(user_id);
create index idx_orders_correlation_id on orders(correlation_id);
create index idx_orders_created_at on orders(created_at);
create index idx_notification_logs_order_id on notification_logs(order_id);
```

---

## 9. Veri Akışı ile Eşleşme

Dokümanlardaki akış ile veritabanı eşleşmesi şu şekildedir:

1. `POST /orders` çağrısı gelir.
2. `orders` ve `order_items` tablolarına kayıt yazılır.
3. `OrderCreated` event'i publish edilir.
4. Payment worker sonucu `payments` tablosuna yazar.
5. Inventory worker sonucu `inventory_reservations` ve `inventory_reservation_items` tablolarına yazar.
6. Notification worker sonucu `notification_logs` tablosuna yazar.
7. Her worker işlediği mesaj için `processed_events` kaydı oluşturur.

---

## 10. MVP İçin Minimum Şema

MVP aşamasında şu tablolar yeterlidir:

* `orders`
* `order_items`
* `payments`
* `inventory_reservations`
* `inventory_reservation_items`
* `notification_logs`
* `processed_events`

Eğer daha da sade başlamak istenirse ilk iterasyonda sadece şu tablolarla başlanabilir:

* `orders`
* `order_items`
* `processed_events`

Bu durumda payment, inventory ve notification sonuçları önce yalnızca log seviyesinde tutulur.

---

## 11. Uygulama Notları

Kod tarafında veritabanı modülü için şu ayrım mantıklı olur:

```text
apps/shared/
  db/
    migrations/
    schema/
    repositories/
```

Eğer ORM kullanılacaksa:

* Prisma
* TypeORM
* Drizzle

Bu demo repo için öğrenmesi ve migration yönetimi açısından `Prisma` iyi başlangıç seçeneğidir.
