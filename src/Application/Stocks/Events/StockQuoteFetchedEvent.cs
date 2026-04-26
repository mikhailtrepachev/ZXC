namespace ZxcBank.Application.Stocks.Events;

public record StockQuoteFetchedEvent
{
    public string Ticker { get; init; } = string.Empty;
    public decimal Price { get; init; }
    public DateTime FetchedAt { get; init; }
}