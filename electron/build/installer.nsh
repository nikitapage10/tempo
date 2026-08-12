; TEMPO Desktop — assisted NSIS wizard customisation.
; Included by electron-builder when packaging Windows.

!macro customHeader
  !define MUI_WELCOMEPAGE_TITLE "Welcome to TEMPO"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "TEMPO Desktop keeps your music workspace on this computer — same catalog as the web, ready offline when you need it.$\r$\n$\r$\nNext you’ll choose where to install, and whether you want Start Menu and desktop shortcuts."
  !define MUI_FINISHPAGE_TITLE "TEMPO is ready"
  !define MUI_FINISHPAGE_TEXT "You’re set. Open TEMPO and sign in with the same account you use on the web."
  !define MUI_FINISHPAGE_RUN_TEXT "Open TEMPO"
  !define MUI_UNWELCOMEPAGE_TEXT "This removes TEMPO Desktop from this computer. Your music on the web is untouched."
!macroend

; Assisted installers do not show a welcome page unless we add one.
!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
