namespace ZxcBank.Domain.Entities;

public class Transaction : BaseAuditableEntity
{
    public required string FromAccountId { get; set; }
    
    public required string ToAccountId { get; set; }
    
    public decimal Amount { get; set; }
    
    public TransactionStatus Status { get; set; }
    
    public string? ApprovedBy { get; set; } // in case of children accounts

    public string? Description { get; set; }
}
