using Microsoft.EntityFrameworkCore;
using OrderService.Data;
using OrderService.Services;

var builder = WebApplication.CreateBuilder(args);

// ─── Config ──────────────────────────────────────────────
var dbHost     = builder.Configuration["DB_HOST"]     ?? "postgres";
var dbUser     = builder.Configuration["DB_USER"]     ?? "postgres";
var dbPass     = builder.Configuration["DB_PASS"]     ?? "postgres";
var connString = $"Host={dbHost};Port=5432;Database=orderdb;Username={dbUser};Password={dbPass}";
builder.Configuration["LogServiceUrl"] = builder.Configuration["LOG_SERVICE_URL"] ?? "http://log-service:8006";

// ─── Services ────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c => c.SwaggerDoc("v1", new() { Title = "Order Service", Version = "v1" }));

builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(connString));

builder.Services.AddScoped<IOrderService, OrderServiceImpl>();
builder.Services.AddHttpClient<ILogService, LogService>();

builder.Services.AddCors(o => o.AddPolicy("AllowAll", b =>
    b.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

builder.Services.AddHealthChecks()
    .AddNpgSql(connString, name: "postgres");

// ─── App ─────────────────────────────────────────────────
var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();
app.MapHealthChecks("/health");

// Auto migrate on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.Run("http://0.0.0.0:8003");
