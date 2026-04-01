namespace OrderService.Services;

public interface ILogService
{
    Task LogAsync(string service, string action, string detail, int status = 200);
}

public class LogService : ILogService
{
    private readonly HttpClient      _http;
    private readonly IConfiguration  _cfg;
    private readonly ILogger<LogService> _logger;

    public LogService(HttpClient http, IConfiguration cfg, ILogger<LogService> logger)
    {
        _http   = http;
        _cfg    = cfg;
        _logger = logger;
    }

    public async Task LogAsync(string service, string action, string detail, int status = 200)
    {
        try
        {
            var url = _cfg["LogServiceUrl"] ?? "http://log-service:8006";
            await _http.PostAsJsonAsync($"{url}/api/logs", new
            {
                service,
                action,
                detail,
                status,
                level     = status >= 500 ? "ERROR" : status >= 400 ? "WARN" : "INFO",
                timestamp = DateTime.UtcNow.ToString("o"),
            });
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Log send failed: {msg}", ex.Message);
        }
    }
}
