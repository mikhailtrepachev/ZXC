using System.Net.Http.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Financial;
using ZxcBank.Domain.Enums;

namespace ZxcBank.Infrastructure.Services;

public class FinancialDataService : IFinancialDataService
{
    private readonly HttpClient _httpClient;
    private readonly ICacheService _cacheService;
    private readonly string _finnhubApiKey;
    private readonly ILogger<FinancialDataService> _logger;
    private readonly ICurrencyService _currencyService;

    public FinancialDataService(HttpClient httpClient, ICacheService cacheService, IConfiguration configuration, ILogger<FinancialDataService> logger, ICurrencyService currencyService)
    {
        _httpClient = httpClient;
        _cacheService = cacheService;
        _logger = logger;
        _finnhubApiKey = configuration["FinnhubSettings:ApiKey"] ?? throw new Exception("FinnhubApiKey is not set in configuration");
        _currencyService = currencyService;
    }
    
    public async Task<List<NewsArticleDto>> GetLatestNewsAsync(CancellationToken cancellationToken)
    {
        string cacheKey = "financial_news_latest";
        
        List<NewsArticleDto>? cachedNews = await _cacheService.GetValueTask<List<NewsArticleDto>>(cacheKey, cancellationToken);
        
        if (cachedNews != null) 
            return cachedNews;

        string url = $"https://finnhub.io/api/v1/news?category=general&token={_finnhubApiKey}";

        List<FinnhubNewsItem>? response = await _httpClient.GetFromJsonAsync<List<FinnhubNewsItem>>(url, cancellationToken);

        if (response is null || !response.Any())
        {
            _logger.LogWarning("Finnhub API returned empty or null news list");
            return new List<NewsArticleDto>();
        }
        
        List<NewsArticleDto> articles = response.Take(15).Select(article => new NewsArticleDto
        {
            Id = article.Id.ToString(),
            Category = string.IsNullOrWhiteSpace(article.Category) ? "MARKETS" : article.Category.ToUpper(),
            Title = article.Headline,
            Description = article.Summary,
            Source = article.Source,
            PublishedAt = DateTimeOffset.FromUnixTimeMilliseconds(article.Datetime).UtcDateTime,
            ReadTime = $"{Math.Max(1, article.Summary.Split(' ', StringSplitOptions.RemoveEmptyEntries).Length / 200)} min",
            Impact = DetermineImpact(article.Summary),
            Sentiment = DetermineSentiment(article.Summary)
        }).ToList();
        
        await _cacheService.SetValueTask(cacheKey, articles, TimeSpan.FromMinutes(15), cancellationToken);
        
        return articles;
    }

    public async Task<MarketSnapshotDto> GetMarketSnapshotAsync(CancellationToken cancellationToken)
    {
        string cacheKey = "market_snapshot_latest";
        
        MarketSnapshotDto? cachedSnapshot = await _cacheService.GetValueTask<MarketSnapshotDto>(cacheKey, cancellationToken);
        
        if (cachedSnapshot != null)
            return cachedSnapshot;

        decimal eurCzk = 0;
        decimal usdCzk = 0;
        
        try
        {
            eurCzk = await _currencyService.GetExchangeRateAsync(Currency.Euro, Currency.Koruna);
            usdCzk = await _currencyService.GetExchangeRateAsync(Currency.Dollar, Currency.Koruna);
        }
        catch (Exception ex)
        {
            _logger.LogError("Failed to get currency rates from CurrencyService: {Error}", ex.Message);
        }
        
        MarketSnapshotDto snapshot = new MarketSnapshotDto
        {
            BankIndexPercentChange = 0.8m, // TODO: real value     
            EurCzkRate = Math.Round(eurCzk, 2),
            UsdCzkRate = Math.Round(usdCzk, 2),  
            TenYearYieldPercent = 4.12m, // TODO: real value
            LastUpdated = DateTime.UtcNow
        };

        await _cacheService.SetValueTask(cacheKey, snapshot, TimeSpan.FromMinutes(15), cancellationToken);

        return snapshot;
    }
    
    private static string DetermineImpact(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "Low";
        
        string lowerText = text.ToLower();
        if (lowerText.Contains("crash") || lowerText.Contains("surge") || lowerText.Contains("rate") || lowerText.Contains("fed")) 
            return "High";
        
        if (lowerText.Contains("trade") || lowerText.Contains("yield") || lowerText.Contains("earnings") || lowerText.Contains("bank")) 
            return "Medium";
            
        return "Low";
    }

    private static string DetermineSentiment(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return "neutral";
        
        string lowerText = text.ToLower();
        if (lowerText.Contains("crash") || lowerText.Contains("fall") || lowerText.Contains("drop") || lowerText.Contains("bear")) 
            return "negative";
            
        if (lowerText.Contains("surge") || lowerText.Contains("jump") || lowerText.Contains("rise") || lowerText.Contains("bull") || lowerText.Contains("profit")) 
            return "positive";
            
        return "neutral";
    }
}
