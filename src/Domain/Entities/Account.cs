namespace ZxcBank.Domain.Entities;

public class Account : BaseAuditableEntity
{
    public required string OwnerId { get; set; }

    public required string AccountNumber { get; set; }
    
    public decimal Balance { get; set; }
    
    public bool IsFrozen { get; set; }
    
    public IList<Card> Cards { get; private set; } = new List<Card>();
}
