from robot.libraries.BuiltIn import BuiltIn
from selenium.webdriver.common.by import By


class FormHelpers:
    """Date input and read-only coverage checks for the repair form."""

    def fill_text(self, locator, value):
        library = BuiltIn().get_library_instance('SeleniumLibrary')
        library.scroll_element_into_view(locator)
        element = library.find_element(locator)
        library.driver.execute_script("""
            const [element, value] = arguments;
            element.focus();
            const prototype = element.tagName === 'TEXTAREA'
                ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value);
            element.dispatchEvent(new Event('input', {bubbles: true}));
            element.dispatchEvent(new Event('change', {bubbles: true}));
            element.blur();
        """, element, str(value))
        assert element.get_attribute('value') == str(value), f'Incorrect value in {locator}'
        BuiltIn().sleep(BuiltIn().get_variable_value('${STEP_DELAY}', '0.2 seconds'))

    def set_date_field(self, locator, value):
        library = BuiltIn().get_library_instance('SeleniumLibrary')
        element = library.find_element(locator)
        library.scroll_element_into_view(locator)
        library.driver.execute_script("""
            const [element, value] = arguments;
            const setter = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype, 'value').set;
            setter.call(element, value);
            element.dispatchEvent(new Event('input', {bubbles: true}));
            element.dispatchEvent(new Event('change', {bubbles: true}));
        """, element, value)
        assert element.get_attribute('value') == value
        BuiltIn().sleep(BuiltIn().get_variable_value('${STEP_DELAY}', '0.2 seconds'))

    def all_available_fields_should_be_filled(self):
        driver = BuiltIn().get_library_instance('SeleniumLibrary').driver
        fields = driver.find_elements(
            By.CSS_SELECTOR, '[data-testid="repair-job-form"] input, '
            '[data-testid="repair-job-form"] select, '
            '[data-testid="repair-job-form"] textarea')
        empty = []
        for field in fields:
            if (not field.is_displayed() or not field.is_enabled()
                    or field.get_attribute('readonly')
                    or field.get_attribute('type') in ('file', 'hidden', 'button', 'submit')):
                continue
            if not (field.get_attribute('value') or '').strip():
                empty.append(field.get_attribute('outerHTML'))
        assert not empty, 'Unfilled editable fields: ' + '\n'.join(empty)
