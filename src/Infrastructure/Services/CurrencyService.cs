using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;
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
    private readonly IMemoryCache _cache;

    // Conservative fallback rates for offline mode.
    private static readonly IReadOnlyDictionary<string, decimal> FallbackRateToCzk =
        new Dictionary<string, decimal>
        {
            ["CZK"] = 1m,
            ["EUR"] = 25m,
            ["USD"] = 23m,
        };

    public RealCurrencyService(HttpClient httpClient, IMemoryCache cache)
    {
        _httpClient = httpClient;
        _cache = cache;
    }

    public async Task<decimal> ConvertAsync(decimal amount, Currency from, Currency to)
    {
        if (from == to)
        {
            return amount;
        }

        string fromCode = MapCurrencyCode(from);
        string toCode = MapCurrencyCode(to);
        string cacheKey = $"rate_{fromCode}_{toCode}";

        if (_cache.TryGetValue(cacheKey, out decimal cachedRate))
        {
            return amount * cachedRate;
        }

        var liveRate = await TryGetLiveRateAsync(fromCode, toCode);
        if (liveRate.HasValue)
        {
            _cache.Set(cacheKey, liveRate.Value, TimeSpan.FromHours(1));
            return amount * liveRate.Value;
        }

        var fallbackRate = GetFallbackRate(fromCode, toCode);
        _cache.Set(cacheKey, fallbackRate, TimeSpan.FromMinutes(10));
        return amount * fallbackRate;
    }

    private async Task<decimal?> TryGetLiveRateAsync(string fromCode, string toCode)
    {
        try
        {
            var response = await _httpClient.GetFromJsonAsync<ExchangeRateResponse>(
                $"https://api.frankfurter.app/latest?from={fromCode}&to={toCode}");

            if (response != null && response.Rates.TryGetValue(toCode, out var rate) && rate > 0)
            {
                return rate;
            }
        }
        catch
        {
            // Ignore network/API errors and fall back to static rates.
        }

        return null;
    }

    private static decimal GetFallbackRate(string fromCode, string toCode)
    {
        if (!FallbackRateToCzk.TryGetValue(fromCode, out var fromToCzk) ||
            !FallbackRateToCzk.TryGetValue(toCode, out var toToCzk))
        {
            throw new Exception($"Nelze urcit konverzni kurz pro par {fromCode}/{toCode}.");
        }

        return fromToCzk / toToCzk;
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
