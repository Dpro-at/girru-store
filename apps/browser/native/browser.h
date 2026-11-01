#pragma once
#include "include/cef_app.h"
CefRefPtr<CefApp> CreateGirruApp();
void CloseGirruBrowsers();

void HideGirruBrowser(CefWindowHandle view);
