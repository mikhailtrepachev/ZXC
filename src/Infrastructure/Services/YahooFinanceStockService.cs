using System.Text.Json;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Stocks.Queries.GetStockQuote;

namespace ZxcBank.Infrastructure.Services;

public class YahooFinanceStockService : IStockService
{
    private readonly HttpClient _httpClient;

    public YahooFinanceStockService(HttpClient httpClient)
    {
        _httpClient = httpClient;
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");
    }

    public async Task<StockQuoteDto> GetQuoteAsync(string ticker, CancellationToken cancellationToken)
    {
        string url = $"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}";
        HttpResponseMessage response = await _httpClient.GetAsync(url, cancellationToken);
        
        response.EnsureSuccessStatusCode();
        
        string json = await response.Content.ReadAsStringAsync(cancellationToken);
        using JsonDocument doc = JsonDocument.Parse(json);
        
        JsonElement result = doc.RootElement
            .GetProperty("chart")
            .GetProperty("result")[0]
            .GetProperty("meta");

        decimal regularMarketPrice = result.GetProperty("regularMarketPrice").GetDecimal();
        decimal previousClose = result.GetProperty("previousClose").GetDecimal();
        string currency = result.GetProperty("currency").GetString() ?? "USD";
        
        decimal changePercent = previousClose > 0M 
            ? ((regularMarketPrice - previousClose) / previousClose) * 100M 
            : 0M;

        return new StockQuoteDto
        {
            Ticker = ticker,
            CurrentPrice = regularMarketPrice,
            ChangePercent = Math.Round(changePercent, 2),
            Currency = currency
        };
    }
}