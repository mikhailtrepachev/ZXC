using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.AspNetCore.Identity;

namespace ZxcBank.Application.Admin.Commands.ResetPassword;

/*
public record AdminResetPasswordCommand : IRequest
{
    public string UserId { get; init; } // ID пользователя (Guid)
    public string NewPassword { get; init; }
}

public class AdminResetPasswordCommandHandler : IRequestHandler<AdminResetPasswordCommand>
{

    public AdminResetPasswordCommandHandler(UserManager<ApplicationUser> userManager)
    {
        _userManager = userManager;
    }

    public async Task Handle(AdminResetPasswordCommand request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(request.UserId);
        if (user == null) throw new Exception("Пользователь не найден");

        // 1. Удаляем текущий пароль (какой бы он ни был)
        if (await _userManager.HasPasswordAsync(user))
        {
            await _userManager.RemovePasswordAsync(user);
        }

        // 2. Устанавливаем новый
        var result = await _userManager.AddPasswordAsync(user, request.NewPassword);

        if (!result.Succeeded)
        {
            throw new Exception($"Не удалось сбросить пароль: {string.Join(", ", result.Errors)}");
        }
    }
}
*/

