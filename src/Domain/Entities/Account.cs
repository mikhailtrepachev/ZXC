namespace ZxcBank.Domain.Entities;

public class Account : BaseAuditableEntity
{
    public required string OwnerId { get; set; }

    public required string AccountNumber { get; set; }
    
    public decimal Balance { get; set; }
    
    public bool IsFrozen { get; set; }
    
    public required Currency Currency { get; set; }
    
    public required AccountType Type { get; set; }

    public Client Client { get; set; } = null!;
    
    public IList<Card> Cards { get; private set; } = new List<Card>();
}
