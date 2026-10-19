<#--
  Halsa page shell (plan Appendix A.3). Copied from Keycloak 26.4 base/login/template.ftl; the
  head scripts, the attempted-username block, the try-another-way form and every nested section are
  kept as they are. The markup around them changes: a brand panel on desktop, a brand bar on mobile,
  one card, and a footer. The language switcher is not rendered: the realms support only "es".
-->
<#import "footer.ftl" as loginFooter>
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign halsaVariant = properties.halsaVariant!"personal">
<!DOCTYPE html>
<html class="${properties.kcHtmlClass!}" lang="${lang}" data-variant="${halsaVariant}"<#if realm.internationalizationEnabled> dir="${(locale.rtl)?then('rtl','ltr')}"</#if>>

<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />

    <#if properties.meta?has_content>
        <#list properties.meta?split(' ') as meta>
            <meta name="${meta?split('==')[0]}" content="${meta?split('==')[1]}"/>
        </#list>
    </#if>
    <meta name="color-scheme" content="light dark"/>
    <meta name="robots" content="noindex, nofollow"/>
    <title>${msg("loginTitle",(realm.displayName!''))}</title>
    <link rel="icon" href="${url.resourcesPath}/img/favicon.svg" type="image/svg+xml" />
    <#if properties.stylesCommon?has_content>
        <#list properties.stylesCommon?split(' ') as style>
            <link href="${url.resourcesCommonPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#-- halsa.js runs here, before first paint, so dark mode never flashes. -->
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <script src="${url.resourcesPath}/js/menu-button-links.js" type="module"></script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        import { startSessionPolling } from "${url.resourcesPath}/js/authChecker.js";

        startSessionPolling(
            "${url.ssoLoginInOtherTabsUrl?no_esc}"
        );
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");

            if (!link) {
                return;
            }

            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }

            const { disabledClass } = link.dataset;

            if (disabledClass) {
                link.classList.add(...disabledClass.trim().split(/\s+/));
            }

            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
            import { checkAuthSession } from "${url.resourcesPath}/js/authChecker.js";

            checkAuthSession(
                "${authenticationSession.authSessionIdHash}"
            );
        </script>
    </#if>
</head>

<body class="${properties.kcBodyClass!} ${bodyClass}" data-page-id="login-${pageId}">
<a class="hl-skip" href="#kc-content">${msg("halsaSkipToContent")}</a>
<div class="${properties.kcLoginClass!}">

    <#-- Desktop brand panel (>= 1024 px). Decorative copy, repeated by the mobile brand bar. -->
    <aside class="hl-brand" aria-label="${msg("halsaContextLabel")}">
        <div class="hl-brand-top">
            <@brandLogo/>
            <p class="hl-brand-context">${msg("halsaContextLabel")}</p>
        </div>
        <div class="hl-brand-body">
            <#if halsaVariant == "pacientes">
                <img class="hl-brand-hero" src="${url.resourcesPath}/img/hero.svg" alt="" width="320" height="220"/>
            </#if>
            <p class="hl-brand-headline">${msg("halsaHeadline")}</p>
            <ul class="hl-brand-bullets">
                <li><span class="hl-bullet-chip" aria-hidden="true"><span class="hl-icon hl-icon-bullet-1"></span></span>${msg("halsaBullet1")}</li>
                <li><span class="hl-bullet-chip" aria-hidden="true"><span class="hl-icon hl-icon-bullet-2"></span></span>${msg("halsaBullet2")}</li>
                <li><span class="hl-bullet-chip" aria-hidden="true"><span class="hl-icon hl-icon-bullet-3"></span></span>${msg("halsaBullet3")}</li>
            </ul>
        </div>
    </aside>

    <div class="hl-main">
        <#-- Mobile brand bar (< 1024 px). -->
        <header id="kc-header" class="${properties.kcHeaderClass!}">
            <div id="kc-header-wrapper" class="${properties.kcHeaderWrapperClass!}">
                <@brandLogo/>
                <p class="hl-header-context">${msg("halsaContextLabel")}</p>
            </div>
        </header>

        <main class="hl-main-inner">
            <div class="${properties.kcFormCardClass!}">
                <header class="${properties.kcFormHeaderClass!}">
                <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
                    <h1 id="kc-page-title"><#nested "header"></h1>
                    <#if displayRequiredFields>
                        <p class="hl-required-note"><span class="required" aria-hidden="true">*</span> ${msg("requiredFields")}</p>
                    </#if>
                <#else>
                    <#nested "show-username">
                    <h1 id="kc-page-title"><#nested "header"></h1>
                    <div id="kc-username" class="hl-attempted-username">
                        <span class="hl-icon hl-icon-user" aria-hidden="true"></span>
                        <label id="kc-attempted-username">${auth.attemptedUsername}</label>
                        <a id="reset-login" href="${url.loginRestartFlowUrl}" title="${msg("restartLoginTooltip")}">
                            <span class="${properties.kcResetFlowIcon!}" aria-hidden="true"></span>
                            <span class="hl-reset-text">${msg("halsaRestartLogin")}</span>
                        </a>
                    </div>
                    <#if displayRequiredFields>
                        <p class="hl-required-note"><span class="required" aria-hidden="true">*</span> ${msg("requiredFields")}</p>
                    </#if>
                </#if>
                </header>

                <div id="kc-content">
                    <div id="kc-content-wrapper">

                    <#-- App-initiated actions should not see warning messages about the need to complete the action -->
                    <#-- during login.                                                                               -->
                    <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                        <div class="${properties.kcAlertClass!} hl-alert-${message.type}" role="<#if message.type = 'error'>alert<#else>status</#if>">
                            <#if message.type = 'success'><span class="${properties.kcFeedbackSuccessIcon!}" aria-hidden="true"></span></#if>
                            <#if message.type = 'warning'><span class="${properties.kcFeedbackWarningIcon!}" aria-hidden="true"></span></#if>
                            <#if message.type = 'error'><span class="${properties.kcFeedbackErrorIcon!}" aria-hidden="true"></span></#if>
                            <#if message.type = 'info'><span class="${properties.kcFeedbackInfoIcon!}" aria-hidden="true"></span></#if>
                            <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
                        </div>
                    </#if>

                    <#nested "form">

                    <#if auth?has_content && auth.showTryAnotherWayLink()>
                        <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                            <div class="${properties.kcFormGroupClass!} hl-try-another-way">
                                <input type="hidden" name="tryAnotherWay" value="on"/>
                                <a href="#" id="try-another-way" class="hl-link"
                                   onclick="document.forms['kc-select-try-another-way-form'].requestSubmit();return false;">${msg("doTryAnotherWay")}</a>
                            </div>
                        </form>
                    </#if>

                    <#nested "socialProviders">

                    <#if displayInfo>
                        <div id="kc-info" class="${properties.kcSignUpClass!}">
                            <div id="kc-info-wrapper" class="${properties.kcInfoAreaWrapperClass!}">
                                <#nested "info">
                            </div>
                        </div>
                    </#if>
                    </div>
                </div>

                <@loginFooter.content/>
            </div>
        </main>

        <footer class="hl-footer">
            <span>${msg("halsaFooter")}</span>
            <#if properties.halsaPrivacyUrl?has_content>
                <a class="hl-link" href="${properties.halsaPrivacyUrl}" target="_blank" rel="noopener noreferrer">${msg("halsaPrivacyLink")}</a>
            </#if>
        </footer>
    </div>
</div>
</body>
</html>
</#macro>

<#macro brandLogo>
    <span class="${properties.kcLogoClass!}">
        <picture>
            <source srcset="${url.resourcesPath}/img/logo-dark.svg" media="(prefers-color-scheme: dark)"/>
            <img src="${url.resourcesPath}/img/logo.svg" alt="" width="32" height="32"/>
        </picture>
        <span class="hl-wordmark">Halsa</span>
    </span>
</#macro>
