namespace ZxcBank.Domain.Entities;

public class Portfolio : BaseAuditableEntity
{
    public required string UserId { get; set; }
    public required string TickerName { get; set; }
    public decimal Quantity { get; set; }
    public decimal AveragePurchasePrice { get; set; }
}
