namespace ZxcBank.Application.Common.Interfaces;

public interface ICacheService
{
    Task<T?> GetValueTask<T>(string key, CancellationToken cancellationToken = default);

    Task SetValueTask<T>(string key, T value, TimeSpan? expirationTime = null,
        CancellationToken cancellationToken = default);
    Task RemoveAsync(string key, CancellationToken cancellationToken = default);
}
