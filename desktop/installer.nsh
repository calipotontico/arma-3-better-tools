!ifndef BUILD_UNINSTALLER
Var abtFinishTitle
Var abtFinishText
Var abtProgressTitle
Var abtProgressText
!endif

!macro preInit
  !ifndef BUILD_UNINSTALLER
    ReadRegStr $0 HKCU "Software\Arma3BetterTools" "InstallerLanguage"
    ${If} $0 != ""
      StrCpy $LANGUAGE $0
    ${Else}
      ${IfNot} ${isUpdated}
        !insertmacro MUI_LANGDLL_DISPLAY
      ${EndIf}
    ${EndIf}
  !endif
!macroend

!macro customInit
  StrCpy $abtFinishTitle "Installation complete"
  StrCpy $abtFinishText "Arma 3 Better Tools is ready to use."
  StrCpy $abtProgressTitle "Installing Arma 3 Better Tools"
  StrCpy $abtProgressText "Please wait while the application is installed."
  ${If} $LANGUAGE == 1034
    StrCpy $abtFinishTitle "Instalación completada"
    StrCpy $abtFinishText "Arma 3 Better Tools está listo para usar."
    StrCpy $abtProgressTitle "Instalando Arma 3 Better Tools"
    StrCpy $abtProgressText "Espera mientras se instala la aplicación."
  ${EndIf}
  ${If} ${isUpdated}
    StrCpy $abtFinishTitle "Update complete"
    StrCpy $abtFinishText "Arma 3 Better Tools has been updated. Your projects and settings are preserved."
    StrCpy $abtProgressTitle "Updating Arma 3 Better Tools"
    StrCpy $abtProgressText "Please wait while the update is applied."
    ${If} $LANGUAGE == 1034
      StrCpy $abtFinishTitle "Actualización completada"
      StrCpy $abtFinishText "Arma 3 Better Tools se ha actualizado. Tus proyectos y ajustes se conservan."
      StrCpy $abtProgressTitle "Actualizando Arma 3 Better Tools"
      StrCpy $abtProgressText "Espera mientras se aplica la actualización."
    ${EndIf}
    System::Call 'user32::SetWindowText(p $HWNDPARENT, t "$abtProgressTitle")'
  ${EndIf}
!macroend

!macro customInstallMode
  ${If} ${isUpdated}
    ${If} $hasPerUserInstallation == "1"
    ${AndIf} $hasPerMachineInstallation != "1"
      StrCpy $isForceCurrentInstall "1"
    ${ElseIf} $hasPerMachineInstallation == "1"
    ${AndIf} $hasPerUserInstallation != "1"
      StrCpy $isForceMachineInstall "1"
    ${EndIf}
  ${EndIf}
!macroend

!macro customPageAfterChangeDir
  !define MUI_PAGE_HEADER_TEXT "$abtProgressTitle"
  !define MUI_PAGE_HEADER_SUBTEXT "$abtProgressText"
!macroend

!macro customFinishPage
  Function ABTStart
    StrCpy $1 ""
    ${If} ${isUpdated}
      StrCpy $1 "--updated"
    ${EndIf}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd
  !define MUI_FINISHPAGE_TITLE "$abtFinishTitle"
  !define MUI_FINISHPAGE_TEXT "$abtFinishText"
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_FUNCTION ABTStart
  !insertmacro MUI_PAGE_FINISH
!macroend

!macro customInstall
  WriteRegStr HKCU "Software\Arma3BetterTools" "InstallerLanguage" "$LANGUAGE"
  SetOutPath $INSTDIR
  File /oname=abt-app.ico "${BUILD_RESOURCES_DIR}\app.ico"
  ${If} ${FileExists} "$newDesktopLink"
    CreateShortCut "$newDesktopLink" "$INSTDIR\${APP_EXECUTABLE_FILENAME}" "" "$INSTDIR\abt-app.ico" 0
  ${EndIf}
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
