namespace ZxcBank.Domain.Entities;

public class Child : Client
{
    public required string ParentId { get; set; }

    public required virtual Client Parent { get; set; }
}
