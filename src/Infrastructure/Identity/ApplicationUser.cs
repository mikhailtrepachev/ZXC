using Microsoft.AspNetCore.Identity;

namespace ZxcBank.Infrastructure.Identity;

public class ApplicationUser : IdentityUser
{
    public bool IsFrozen { get; set; } = false;
}
