using System;

namespace ZxcBank.Application.Stocks.Events;

public record StockBoughtEvent
{
    public string UserId { get; init; } = string.Empty;
    public string TickerName { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal TotalCost { get; init; }
    public DateTime PurchasedAt { get; init; }
}