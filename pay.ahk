cmd := %1%

IfWinExist, Minecraft
{
    WinActivate
}

Sleep, 200
Send, t
Sleep, 100
Send, %cmd%
Sleep, 100
Send, {Enter}