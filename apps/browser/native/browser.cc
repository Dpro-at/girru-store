#include "browser.h"
#include <algorithm>
#include <string>
#include <vector>
#include <map>
#include <filesystem>
#include <fstream>
#include "include/cef_parser.h"
#include "include/cef_task.h"
#include "include/cef_browser.h"
#include "include/cef_client.h"
#include "include/cef_command_line.h"
#include "include/cef_download_handler.h"
#include "include/cef_permission_handler.h"
#include "include/cef_request_handler.h"
#include "include/wrapper/cef_helpers.h"
namespace {
std::map<std::string,CefRefPtr<CefRequestContext>> workspaces;
class BrowserClient final : public CefClient,public CefLifeSpanHandler,public CefRequestHandler,public CefDownloadHandler,public CefPermissionHandler{
 public:
 CefRefPtr<CefLifeSpanHandler> GetLifeSpanHandler()override{return this;}
 CefRefPtr<CefRequestHandler> GetRequestHandler()override{return this;}
 CefRefPtr<CefDownloadHandler> GetDownloadHandler()override{return this;}
 CefRefPtr<CefPermissionHandler> GetPermissionHandler()override{return this;}
 void OnAfterCreated(CefRefPtr<CefBrowser> browser)override{CEF_REQUIRE_UI_THREAD();browsers_.push_back(browser);if(CefCommandLine::GetGlobalCommandLine()->HasSwitch("girru-embedded"))HideGirruBrowser(browser->GetHost()->GetWindowHandle());}
 void OnBeforeClose(CefRefPtr<CefBrowser> browser)override{CEF_REQUIRE_UI_THREAD();std::erase_if(browsers_,[&](const auto& b){return b->IsSame(browser);});if(browsers_.empty()){workspaces.clear();CefQuitMessageLoop();}}
 bool OnBeforeBrowse(CefRefPtr<CefBrowser> browser,CefRefPtr<CefFrame> frame,CefRefPtr<CefRequest> request,bool user_gesture,bool redirect)override{
  if(browser->GetHost()->GetRequestContext()->IsSame(CefRequestContext::GetGlobalContext()))return false;
  const auto url=request->GetURL().ToString();
  if(url.starts_with("https://")||url.starts_with("http://")||url.starts_with("about:blank"))return false;
  const auto helper=CefCommandLine::GetGlobalCommandLine()->GetSwitchValue("girru-extension-id").ToString();
  if(url.starts_with("chrome-extension://")&&!url.starts_with("chrome-extension://"+helper+"/"))return false;
  return true;
 }
 bool CanDownload(CefRefPtr<CefBrowser> browser,const CefString& url,const CefString& method)override{return browser->GetHost()->GetRequestContext()->IsSame(CefRequestContext::GetGlobalContext());}
 bool OnShowPermissionPrompt(CefRefPtr<CefBrowser> browser,uint64_t prompt_id,const CefString& origin,uint32_t requested,CefRefPtr<CefPermissionPromptCallback> callback)override{
  if(browser->GetHost()->GetRequestContext()->IsSame(CefRequestContext::GetGlobalContext()))return false;
  callback->Continue(CEF_PERMISSION_RESULT_DENY);return true;
 }
 void Hide(){CEF_REQUIRE_UI_THREAD();if(CefCommandLine::GetGlobalCommandLine()->HasSwitch("girru-embedded"))for(const auto& browser:browsers_)HideGirruBrowser(browser->GetHost()->GetWindowHandle());}
 void Close(){CEF_REQUIRE_UI_THREAD();const auto browsers=browsers_;for(auto browser:browsers)browser->GetHost()->CloseBrowser(false);}
 private:std::vector<CefRefPtr<CefBrowser>> browsers_;IMPLEMENT_REFCOUNTING(BrowserClient);
};
CefRefPtr<BrowserClient> client;
void ProcessPreferences();
class PreferencePoll final:public CefTask{public:void Execute()override{ProcessPreferences();}private:IMPLEMENT_REFCOUNTING(PreferencePoll);};
void ProcessPreferences(){
 if(client)client->Hide();
 const auto directory=CefCommandLine::GetGlobalCommandLine()->GetSwitchValue("girru-control-dir").ToString();
 if(!directory.empty()){
  std::error_code ec;
  for(const auto& file:std::filesystem::directory_iterator(directory,ec)){
   if(!file.is_regular_file()||file.path().extension()!=".json"||file.file_size()>16384)continue;
   std::ifstream in(file.path());const std::string raw((std::istreambuf_iterator<char>(in)),{});auto value=CefParseJSON(raw,JSON_PARSER_RFC);
   auto result=CefDictionaryValue::Create();bool success=false;
   if(value&&value->GetType()==VTYPE_DICTIONARY){auto input=value->GetDictionary();if(input->GetString("action")=="preferences"&&input->GetType("settings")==VTYPE_DICTIONARY){success=true;auto settings=input->GetDictionary("settings");CefDictionaryValue::KeyList keys;settings->GetKeys(keys);for(const auto& key:keys){auto name=key.ToString();if(name!="homepage"&&name!="homepage_is_newtabpage"&&name!="bookmark_bar.show_on_all_tabs"){success=false;continue;}CefString error;if(!CefRequestContext::GetGlobalContext()->SetPreference(key,settings->GetValue(key),error))success=false;}}
    if(input->GetString("action")=="create-tab"){
     const auto workspace=input->GetString("workspace").ToString(),url=input->GetString("url").ToString();
     const auto valid=[](const std::string& name){return !name.empty()&&name.size()<=160&&name.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-")==std::string::npos;};
     if(valid(workspace)&&url.starts_with("about:blank#girru-")&&url.size()<200){
      CefRefPtr<CefRequestContext> context;
      if(workspace=="owner")context=CefRequestContext::GetGlobalContext();
      else{auto& saved=workspaces[workspace];if(!saved){CefRequestContextSettings isolated;const auto root=CefCommandLine::GetGlobalCommandLine()->GetSwitchValue("cache-path").ToString();CefString(&isolated.cache_path)=root+"/Workspace-"+workspace;saved=CefRequestContext::CreateContext(isolated,nullptr);}context=saved;}
      CefWindowInfo window;window.runtime_style=CEF_RUNTIME_STYLE_CHROME;window.hidden=CefCommandLine::GetGlobalCommandLine()->HasSwitch("girru-embedded");CefBrowserSettings settings;
      success=CefBrowserHost::CreateBrowser(window,client,url,settings,nullptr,context);
     }
    }
   }
   result->SetBool("ok",success);auto wrapped=CefValue::Create();wrapped->SetDictionary(result);std::ofstream out(file.path().string()+".reply");out<<CefWriteJSON(wrapped,JSON_WRITER_DEFAULT).ToString();out.close();std::filesystem::remove(file.path(),ec);
  }
 }
 CefPostDelayedTask(TID_UI,new PreferencePoll,100);
}

class BrowserApplication final:public CefApp,public CefBrowserProcessHandler{
 public:
 CefRefPtr<CefBrowserProcessHandler> GetBrowserProcessHandler()override{return this;}
 CefRefPtr<CefClient> GetDefaultClient()override{return client;}
 void OnContextInitialized()override{
  CEF_REQUIRE_UI_THREAD();client=new BrowserClient;ProcessPreferences();
  CefRequestContext::GetGlobalContext()->SetChromeColorScheme(CEF_COLOR_VARIANT_DARK,CefColorSetARGB(255,114,155,255));
  CefWindowInfo info;info.runtime_style=CEF_RUNTIME_STYLE_CHROME;info.hidden=CefCommandLine::GetGlobalCommandLine()->HasSwitch("girru-embedded");CefBrowserSettings settings;
  const auto url=CefCommandLine::GetGlobalCommandLine()->GetSwitchValue("url");
  CefBrowserHost::CreateBrowser(info,client,url.empty()?"chrome://newtab/":url,settings,nullptr,nullptr);
 }
 private:IMPLEMENT_REFCOUNTING(BrowserApplication);
};
}
CefRefPtr<CefApp> CreateGirruApp(){return new BrowserApplication;}
void CloseGirruBrowsers(){if(client)client->Close();}
