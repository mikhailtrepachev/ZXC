namespace ZxcBank.Domain.Entities;

public class Client : BaseAuditableEntity
{
    public required string UserId { get; set; }
    
    public required string FirstName { get; set; }
    
    public required string LastName { get; set; }
    
    public required string PhoneNumber { get; set; }

    public required string State { get; set; }
    
    public required string Street { get; set; }
    
    public decimal DailyTransferLimit { get; set; }
    
    public decimal InternetPaymentLimit { get; set; }
    
    public IList<Account> Accounts { get; private set; } = new List<Account>();
}
