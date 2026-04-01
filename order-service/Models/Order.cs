namespace OrderService.Models;

// ─── Entities ─────────────────────────────────────────────
public class Order
{
    public int            Id          { get; set; }
    public string         UserId      { get; set; } = "";
    public List<OrderItem> Items      { get; set; } = new();
    public decimal        TotalAmount { get; set; }
    public string         Status      { get; set; } = "PENDING";
    // PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
    // PENDING → CANCELLED
    // DELIVERED → REFUNDED
    public string         Notes       { get; set; } = "";
    public DateTime       CreatedAt   { get; set; } = DateTime.UtcNow;
    public DateTime       UpdatedAt   { get; set; } = DateTime.UtcNow;
}

public class OrderItem
{
    public int     Id          { get; set; }
    public int     OrderId     { get; set; }
    public int     ProductId   { get; set; }
    public string  ProductName { get; set; } = "";
    public int     Quantity    { get; set; }
    public decimal Price       { get; set; }
}

// ─── DTOs ─────────────────────────────────────────────────
public class CreateOrderDto
{
    public string           UserId      { get; set; } = "";
    public List<OrderItemDto> Items     { get; set; } = new();
    public decimal          TotalAmount { get; set; }
    public string           Notes       { get; set; } = "";
}

public class OrderItemDto
{
    public int    ProductId   { get; set; }
    public string ProductName { get; set; } = "";
    public int    Quantity    { get; set; }
    public decimal Price      { get; set; }
}

public class UpdateStatusDto
{
    public string Status { get; set; } = "";
    public string Notes  { get; set; } = "";
}

// ─── Stats ────────────────────────────────────────────────
public class OrderStatsDto
{
    public int     Total     { get; set; }
    public int     Pending   { get; set; }
    public int     Confirmed { get; set; }
    public int     Delivered { get; set; }
    public int     Cancelled { get; set; }
    public decimal Revenue   { get; set; }
}
