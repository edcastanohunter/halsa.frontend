<#-- Copied from Keycloak 26.4 base/login/password-commons.ftl, plus the Halsa password helpers. -->
<#macro logoutOtherSessions>
    <div id="kc-form-options" class="${properties.kcFormOptionsClass!}">
        <div class="${properties.kcFormOptionsWrapperClass!}">
            <label class="${properties.kcInputClassCheckbox!}">
                <input type="checkbox" id="logout-sessions" class="${properties.kcCheckboxInputClass!}" name="logout-sessions" value="on">
                <span class="${properties.kcInputClassCheckboxLabel!}">${msg("logoutOtherSessions")}</span>
            </label>
        </div>
    </div>
</#macro>

<#--
  The realm's password policy as a checklist under a new-password field (plan Appendix A.3).
  halsa.js ticks each item live; the server still validates and returns the real errors.
-->
<#macro policyHint id inputId>
    <div id="${id}" class="hl-policy" data-halsa-policy-for="${inputId}">
        <p class="hl-hint">${msg("halsaPolicyTitle")}</p>
        <ul>
            <#if passwordPolicies?? && (passwordPolicies.length!0) gt 0>
                <li data-rule="length" data-value="${passwordPolicies.length}">${msg("halsaPolicyLength", passwordPolicies.length)}</li>
            <#else>
                <li data-rule="length" data-value="8">${msg("halsaPolicyLength", 8)}</li>
            </#if>
            <#if passwordPolicies?? && (passwordPolicies.lowerCase!0) gt 0>
                <li data-rule="lowerCase" data-value="${passwordPolicies.lowerCase}">${msg("halsaPolicyLowerCase", passwordPolicies.lowerCase)}</li>
            </#if>
            <#if passwordPolicies?? && (passwordPolicies.upperCase!0) gt 0>
                <li data-rule="upperCase" data-value="${passwordPolicies.upperCase}">${msg("halsaPolicyUpperCase", passwordPolicies.upperCase)}</li>
            </#if>
            <#if passwordPolicies?? && (passwordPolicies.digits!0) gt 0>
                <li data-rule="digits" data-value="${passwordPolicies.digits}">${msg("halsaPolicyDigits", passwordPolicies.digits)}</li>
            </#if>
            <#if passwordPolicies?? && (passwordPolicies.specialChars!0) gt 0>
                <li data-rule="specialChars" data-value="${passwordPolicies.specialChars}">${msg("halsaPolicySpecialChars", passwordPolicies.specialChars)}</li>
            </#if>
            <li data-rule="unique">${msg("halsaPolicyUnique")}</li>
        </ul>
    </div>
</#macro>

<#-- A password input with the show/hide toggle (base/login/resources/js/passwordVisibility.js). -->
<#macro passwordInput name autocomplete invalid describedBy="" autofocus=false>
    <div class="${properties.kcInputGroup!}" dir="ltr">
        <input type="password" id="${name}" name="${name}" class="${properties.kcInputClass!}"
               autocomplete="${autocomplete}" <#if autofocus>autofocus</#if>
               aria-invalid="<#if invalid>true</#if>"
               <#if describedBy?has_content>aria-describedby="${describedBy}"</#if>
        />
        <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button" aria-label="${msg('showPassword')}"
                aria-controls="${name}" data-password-toggle
                data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}"
                data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
            <i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
        </button>
    </div>
</#macro>
