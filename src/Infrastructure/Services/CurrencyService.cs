using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Enums;

namespace ZxcBank.Infrastructure.Services;

public class ExchangeRateResponse
{
    public decimal Amount { get; set; }
    public required string Base { get; set; }
    public Dictionary<string, decimal> Rates { get; set; } = new();
}

public class RealCurrencyService : ICurrencyService
{
    private readonly HttpClient _httpClient;
    private readonly ICacheService _cache;
    private readonly ILogger<RealCurrencyService> _logger;
    
    // 1% bank margin
    private const decimal BankMarginMultiplier = 1.01m;

    public RealCurrencyService(HttpClient httpClient, ICacheService cache, ILogger<RealCurrencyService> logger)
    {
        _httpClient = httpClient;
        _cache = cache;
        _logger = logger;
    }

    public async Task<decimal> ConvertAsync(decimal amount, Currency from, Currency to)
    {
        if (from == to)
        {
            return amount;
        }

        string fromCode = MapCurrencyCode(from);
        string toCode = MapCurrencyCode(to);
        
        decimal baseRate = await GetLiveRateAsync(fromCode, toCode);
        
        decimal rateWithMargin = baseRate * BankMarginMultiplier;
        
        decimal convertedAmount = amount * rateWithMargin;
        
        return Math.Round(convertedAmount, 2, MidpointRounding.ToEven);
    }
    
    private async Task<decimal> GetLiveRateAsync(string fromCode, string toCode)
    {
        string cacheKey = $"exchange_rate_{fromCode}_{toCode}";

        decimal? cachedRate = await _cache.GetValueTask<decimal?>(cacheKey, CancellationToken.None);
        
        if (cachedRate.HasValue && cachedRate.Value > 0)
        {
            return cachedRate.Value;
        }

        try
        {
            ExchangeRateResponse? response = await _httpClient.GetFromJsonAsync<ExchangeRateResponse>(
                $"https://api.frankfurter.app/latest?from={fromCode}&to={toCode}");

            if (response != null && response.Rates.TryGetValue(toCode, out decimal rate) && rate > 0)
            {
                await _cache.SetValueTask(cacheKey, rate, TimeSpan.FromHours(1), CancellationToken.None);
                return rate;
            }
            
            _logger.LogError("Error on API response from frankfurter");
            throw new Exception("API vrátilo neplatná nebo prázdná data.");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Nepodařilo se získat kurz pro {FromCode}/{ToCode} z externího API", fromCode, toCode);
            throw new Exception("Služba pro převody měn je momentálně nedostupná. Zkuste to prosím později.");
        }
    }

    private static string MapCurrencyCode(Currency currency)
    {
        return currency switch
        {
            Currency.Dollar => "USD",
            Currency.Euro => "EUR",
            Currency.Koruna => "CZK",
            _ => throw new ArgumentException("Neznama mena."),
        };
    }
}
