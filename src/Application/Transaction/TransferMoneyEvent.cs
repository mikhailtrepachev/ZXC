namespace ZxcBank.Application.Transaction;

public record MoneyTransferredEvent(
    string SenderId,
    string ReceiverId,
    decimal Amount,
    string Message,
    DateTime Timestamp
);


