namespace ZxcBank.Domain.Entities;

public class Stock : BaseAuditableEntity
{
    public required string TickerName { get; set; }
    
    public required string CompanyName { get; set; }
    
    public decimal Price { get; set; }
}
