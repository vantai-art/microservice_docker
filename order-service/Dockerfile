FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder
WORKDIR /app
COPY *.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=builder /publish .
EXPOSE 8003
ENTRYPOINT ["dotnet", "OrderService.dll"]
