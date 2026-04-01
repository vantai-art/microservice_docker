using OrderService.Models;

namespace OrderService.Services;

public interface IOrderService
{
    Task<IEnumerable<Order>> GetAllAsync();
    Task<IEnumerable<Order>> GetByUserIdAsync(string userId);
    Task<Order?>             GetByIdAsync(int id);
    Task<Order>              CreateAsync(CreateOrderDto dto);
    Task<Order?>             UpdateStatusAsync(int id, string status);
    Task<bool>               DeleteAsync(int id);
    Task<OrderStatsDto>      GetStatsAsync();
}
