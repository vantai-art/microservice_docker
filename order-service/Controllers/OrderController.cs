using Microsoft.AspNetCore.Mvc;
using OrderService.Models;
using OrderService.Services;

namespace OrderService.Controllers;

[ApiController]
[Route("api/orders")]
public class OrderController : ControllerBase
{
    private readonly IOrderService _orderService;
    private readonly ILogService   _logService;

    public OrderController(IOrderService orderService, ILogService logService)
    {
        _orderService = orderService;
        _logService   = logService;
    }

    // ─── Get All (Admin / Staff) ──────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var orders = await _orderService.GetAllAsync();
        await _logService.LogAsync("order-service", "GET_ALL_ORDERS", $"count={orders.Count()}");
        return Ok(orders);
    }

    // ─── Get By User ──────────────────────────────────────
    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetByUser(string userId)
    {
        var orders = await _orderService.GetByUserIdAsync(userId);
        await _logService.LogAsync("order-service", "GET_USER_ORDERS", $"userId={userId}");
        return Ok(orders);
    }

    // ─── Get By ID ────────────────────────────────────────
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var order = await _orderService.GetByIdAsync(id);
        if (order == null)
        {
            await _logService.LogAsync("order-service", "GET_ORDER_NOT_FOUND", $"id={id}", 404);
            return NotFound(new { error = "Đơn hàng không tồn tại" });
        }
        await _logService.LogAsync("order-service", "GET_ORDER", $"id={id}");
        return Ok(order);
    }

    // ─── Create ───────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateOrderDto dto)
    {
        if (dto.Items == null || !dto.Items.Any())
            return BadRequest(new { error = "Đơn hàng phải có ít nhất 1 sản phẩm" });

        var order = await _orderService.CreateAsync(dto);
        await _logService.LogAsync("order-service", "CREATE_ORDER",
            $"userId={dto.UserId}, items={dto.Items.Count}, total={dto.TotalAmount}");
        return CreatedAtAction(nameof(GetById), new { id = order.Id }, order);
    }

    // ─── Update Status ────────────────────────────────────
    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateStatusDto dto)
    {
        try
        {
            var order = await _orderService.UpdateStatusAsync(id, dto.Status);
            if (order == null) return NotFound(new { error = "Đơn hàng không tồn tại" });
            await _logService.LogAsync("order-service", "UPDATE_STATUS", $"id={id}, status={dto.Status}");
            return Ok(order);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    // ─── Stats (Admin/Staff) ──────────────────────────────
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var stats = await _orderService.GetStatsAsync();
        await _logService.LogAsync("order-service", "GET_STATS", "dashboard stats requested");
        return Ok(stats);
    }

    // ─── Delete (Admin) ───────────────────────────────────
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var deleted = await _orderService.DeleteAsync(id);
        if (!deleted) return NotFound(new { error = "Đơn hàng không tồn tại" });
        await _logService.LogAsync("order-service", "DELETE_ORDER", $"id={id}");
        return Ok(new { message = "Đã xóa đơn hàng", id });
    }

    // ─── Health ───────────────────────────────────────────
    [HttpGet("/health")]
    public IActionResult Health() => Ok(new { status = "ok", service = "order-service" });
}
