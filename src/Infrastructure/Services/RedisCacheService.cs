using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.Extensions.Caching.Distributed;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Infrastructure.Services;

public class RedisCacheService : ICacheService
{
    private readonly IDistributedCache _cache;

    public RedisCacheService(IDistributedCache cache)
    {
        _cache = cache;        
    }

    public async Task<T?> GetValueTask<T>(string key, CancellationToken cancellationToken = default)
    {
        string? cachedData = await _cache.GetStringAsync(key, cancellationToken);
        
        if (string.IsNullOrEmpty(cachedData))
            return default;
        
        return JsonSerializer.Deserialize<T>(cachedData);       
        
    }

    public async Task SetValueTask<T>(string key, T value, TimeSpan? expirationTime = null,
        CancellationToken cancellationToken = default)
    {
        DistributedCacheEntryOptions options = new DistributedCacheEntryOptions();

        if (expirationTime.HasValue)
        {
            options.AbsoluteExpirationRelativeToNow = expirationTime.Value;
        }
        
        string serializedValue = JsonSerializer.Serialize(value);
        await _cache.SetStringAsync(key, serializedValue, options, cancellationToken);
    }

    public async Task RemoveAsync(string key, CancellationToken cancellationToken = default)
    {
        await _cache.RemoveAsync(key, cancellationToken);
    }
}
