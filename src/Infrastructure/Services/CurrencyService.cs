using System.Net.Http.Json;
using Microsoft.Extensions.Caching.Memory;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Enums;

namespace ZxcBank.Infrastructure.Services;

public class ExchangeRateResponse
{
    public decimal Amount { get; set; }
    public required string Base { get; set; }
    public Dictionary<string, decimal> Rates { get; set; } = new Dictionary<string, decimal>();
}

public class RealCurrencyService : ICurrencyService
{
    private readonly HttpClient _httpClient;
    private readonly IMemoryCache _cache;

    public RealCurrencyService(HttpClient httpClient, IMemoryCache cache)
    {
        _httpClient = httpClient;
        _cache = cache;
    }

    public async Task<decimal> ConvertAsync(decimal amount, Currency from, Currency to)
    {
        // 1. Если валюты одинаковые — возвращаем как есть
        if (from == to) return amount;

        // 2. Превращаем Enum в строковые коды (ISO 4217)
        string fromCode = MapCurrencyCode(from);
        string toCode = MapCurrencyCode(to);

        // 3. Пробуем достать курс из КЭША (чтобы не спамить запросами)
        string cacheKey = $"rate_{fromCode}_{toCode}";
        
        if (!_cache.TryGetValue(cacheKey, out decimal rate))
        {
            try 
            {
                var response = await _httpClient.GetFromJsonAsync<ExchangeRateResponse>(
                    $"https://api.frankfurter.app/latest?from={fromCode}&to={toCode}");

                if (response != null && response.Rates.ContainsKey(toCode))
                {
                    rate = response.Rates[toCode];
                    
                    // Сохраняем в кэш на 1 час
                    _cache.Set(cacheKey, rate, TimeSpan.FromHours(1));
                }
                else
                {
                    // Если API недоступен или вернул ерунду — фолбэк (можно выбросить ошибку)
                    throw new Exception("Не удалось получить курс валют");
                }
            }
            catch
            {
                // На случай, если интернета нет вообще — можно вернуть хардкод или упасть
                throw new Exception($"Сервис курсов валют недоступен. Невозможно перевести {fromCode} в {toCode}");
            }
        }

        return amount * rate;
    }

    private string MapCurrencyCode(Currency currency)
    {
        return currency switch
        {
            Currency.Dollar => "USD",
            Currency.Euro => "EUR",
            Currency.Koruna => "CZK",
            _ => throw new ArgumentException("Неизвестная валюта")
        };
    }
}
