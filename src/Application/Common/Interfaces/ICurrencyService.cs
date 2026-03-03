using ZxcBank.Domain.Enums;

namespace ZxcBank.Application.Common.Interfaces;

public interface ICurrencyService
{
    Task<decimal> ConvertAsync(decimal amount, Currency fromCurrency, Currency toCurrency);
}
