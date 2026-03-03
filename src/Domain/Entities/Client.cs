namespace ZxcBank.Domain.Entities;

public class Client : BaseAuditableEntity
{
    public required string UserId { get; set; }
    
    public decimal DailyTransferLimit { get; set; }
    
    public decimal InternetPaymentLimit { get; set; }
}
