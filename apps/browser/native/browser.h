#pragma once
#include "include/cef_app.h"
CefRefPtr<CefApp> CreateGirruApp();
void CloseGirruBrowsers();

void HideGirruBrowser(CefWindowHandle view);
CefRefPtr<CefDictionaryValue> GirruNativePrompts();
bool RespondGirruNativePrompt(const std::string& prompt,const std::string& action);
std::string GirruRequestId();
