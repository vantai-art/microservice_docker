using Microsoft.EntityFrameworkCore;
using OrderService.Data;
using OrderService.Models;

namespace OrderService.Services;

public class OrderServiceImpl : IOrderService
{
    private readonly AppDbContext _db;

    public OrderServiceImpl(AppDbContext db) => _db = db;

    public async Task<IEnumerable<Order>> GetAllAsync()
        => await _db.Orders.Include(o => o.Items).OrderByDescending(o => o.CreatedAt).ToListAsync();

    public async Task<IEnumerable<Order>> GetByUserIdAsync(string userId)
        => await _db.Orders.Include(o => o.Items)
                           .Where(o => o.UserId == userId)
                           .OrderByDescending(o => o.CreatedAt)
                           .ToListAsync();

    public async Task<Order?> GetByIdAsync(int id)
        => await _db.Orders.Include(o => o.Items).FirstOrDefaultAsync(o => o.Id == id);

    public async Task<Order> CreateAsync(CreateOrderDto dto)
    {
        var order = new Order
        {
            UserId      = dto.UserId,
            TotalAmount = dto.TotalAmount,
            Status      = "PENDING",
            Items       = dto.Items.Select(i => new OrderItem
            {
                ProductId   = i.ProductId,
                ProductName = i.ProductName,
                Quantity    = i.Quantity,
                Price       = i.Price,
            }).ToList(),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();
        return order;
    }

    public async Task<Order?> UpdateStatusAsync(int id, string status)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return null;

        var valid = new[] { "PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED" };
        if (!valid.Contains(status.ToUpper()))
            throw new ArgumentException($"Invalid status: {status}");

        order.Status    = status.ToUpper();
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return order;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return false;
        _db.Orders.Remove(order);
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<OrderStatsDto> GetStatsAsync()
    {
        var orders = await _db.Orders.ToListAsync();
        return new OrderStatsDto
        {
            Total     = orders.Count,
            Pending   = orders.Count(o => o.Status == "PENDING"),
            Confirmed = orders.Count(o => o.Status == "CONFIRMED"),
            Delivered = orders.Count(o => o.Status == "DELIVERED"),
            Cancelled = orders.Count(o => o.Status == "CANCELLED"),
            Revenue   = orders.Where(o => o.Status == "DELIVERED").Sum(o => o.TotalAmount),
        };
    }
}
