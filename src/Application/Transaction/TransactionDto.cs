using ZxcBank.Domain.Enums;

namespace ZxcBank.Application.Transaction;

public class TransactionDto
{
    public int Id { get; set; }
    public decimal Amount { get; set; }
    public TransactionType Type { get; set; } // "Incoming" (Приход) или "Outgoing" (Расход)
    public DateTime Date { get; set; }
    public string? Description { get; set; }
    public required string CounterpartyAccount { get; set; } // От кого или Кому
}
