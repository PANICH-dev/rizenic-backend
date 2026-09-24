import json
import os
import time
from pathlib import Path
from urllib.parse import urlsplit

from robot.api import logger
from robot.libraries.BuiltIn import BuiltIn
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import NoSuchWindowException, StaleElementReferenceException


def dismiss_notices(driver, timeout_seconds=30):
    """Dismiss only explicit close/skip controls; never accept or pay."""
    deadline = time.monotonic() + float(timeout_seconds)
    quiet_since = None
    close_xpath = (
        "//button[normalize-space(.)='ปิดหน้าต่าง' or normalize-space(.)='ปิด' "
        "or normalize-space(.)='ข้าม' or normalize-space(.)='Close' or normalize-space(.)='Skip']"
        " | //input[(@type='button' or @type='image') and "
        "(@value='ปิดหน้าต่าง' or @value='ปิด' or @value='ข้าม' or @alt='ปิดหน้าต่าง')]"
        " | //*[@role='dialog']//button[@aria-label='Close' or @aria-label='ปิด']"
        " | //div[contains(concat(' ',normalize-space(@class),' '),' modal__btn-close ')]"
    )
    while time.monotonic() < deadline:
        changed = False
        main_handle = None
        for handle in list(driver.window_handles):
            try:
                driver.switch_to.window(handle)
                driver.switch_to.default_content()
                url = urlsplit(driver.current_url)
                if url.hostname not in ('eclaim2.blueventuregroup.co.th', 'eclaim3.blueventuregroup.co.th'):
                    continue
                controls = [e for e in driver.find_elements(By.XPATH, close_xpath)
                            if e.is_displayed() and e.is_enabled()]
                if controls:
                    controls[0].click()
                    logger.console('Dismissed an E-Claim notice using its close/skip button')
                    changed = True
                    break
                if url.path.lower().endswith('/frmbill_news.aspx'):
                    # System-entry image button on the billing landing page.
                    # Do not use invoice, payment, printing or account-setting controls.
                    entry = driver.find_elements(By.ID, 'Bntgo')
                    if entry and entry[0].is_displayed():
                        entry[0].click()
                        logger.console('Skipped billing notice through the system-entry navigation tile')
                        changed = True
                        break
                if url.path.lower().endswith('/frmmainlist.aspx'):
                    main_handle = handle
            except (NoSuchWindowException, StaleElementReferenceException):
                changed = True
                break
        if changed:
            quiet_since = None
        elif main_handle:
            driver.switch_to.window(main_handle)
            quiet_since = quiet_since or time.monotonic()
            if time.monotonic() - quiet_since >= 3:
                logger.console('E-Claim main page ready; no further actions performed')
                return
        else:
            quiet_since = None
        time.sleep(0.3)
    raise AssertionError('E-Claim main page not reached: an unfamiliar notice may require a specific close/skip selector. No accept/payment action was attempted.')


class EClaimMonitor:
    """Watch local JSON files and fill credentials without exposing them in Robot logs."""

    def open_vehicle_intake_page(self):
        driver = BuiltIn().get_library_instance('SeleniumLibrary').driver
        current = urlsplit(driver.current_url)
        if current.hostname != 'eclaim2.blueventuregroup.co.th' or not current.query:
            raise AssertionError('Expected authenticated E-Claim session parameters after login')
        # Preserve the current session query byte-for-byte; do not hardcode an old login URL.
        target = current._replace(path='/eclaim/frmKeyIn_InOutCar.aspx', fragment='').geturl()
        driver.get(target)
        WebDriverWait(driver, 30).until(
            lambda d: urlsplit(d.current_url).path.lower() == '/eclaim/frmkeyin_inoutcar.aspx'
            and d.find_element(By.ID, 'ddlInsurer').is_displayed()
            and d.find_element(By.ID, 'txtCarRegNo').is_displayed())
        logger.console('Verified vehicle intake form: frmKeyIn_InOutCar.aspx')

    def dismiss_optional_eclaim_notices(self, timeout_seconds=30):
        library = BuiltIn().get_library_instance('SeleniumLibrary')
        dismiss_notices(library.driver, timeout_seconds)

    def wait_for_ready_json(self, directory, poll_seconds=2, timeout_seconds=0):
        directory = Path(directory).expanduser().resolve()
        directory.mkdir(parents=True, exist_ok=True)
        interval = float(poll_seconds)
        timeout = float(timeout_seconds)
        if interval <= 0 or timeout < 0:
            raise ValueError('Poll interval must be positive and timeout nonnegative')
        logger.console(f'Watching {directory} for a ready *.json file (Ctrl+C to stop)')
        started = time.monotonic()
        previous = {}
        while True:
            current = {}
            for path in sorted(directory.glob('*.json')):
                if not path.is_file():
                    continue
                try:
                    stat = path.stat()
                    signature = (stat.st_size, stat.st_mtime_ns)
                    current[path] = signature
                    if not stat.st_size or previous.get(path) != signature:
                        continue
                    with path.open(encoding='utf-8-sig') as stream:
                        document = json.load(stream)
                    # Drafts with missing Legacy-required values stay in the outbox
                    # for later completion and must not trigger E-Claim automation.
                    if document.get('data_status', 'READY') != 'READY':
                        logger.console(f'JSON skipped (status={document.get("data_status")}): {path.name}')
                        continue
                    after = path.stat()
                    if signature != (after.st_size, after.st_mtime_ns):
                        continue
                    logger.console(f'JSON detected: {path.name}')
                    return str(path)
                except (OSError, ValueError):
                    continue
            previous = current
            if timeout and time.monotonic() - started >= timeout:
                raise AssertionError(f'No ready JSON file found within {timeout:g} seconds')
            time.sleep(interval)

    def fill_eclaim_credentials(self, credentials_file):
        username = os.environ.get('ECLAIM_USERNAME')
        password = os.environ.get('ECLAIM_PASSWORD')
        path = Path(credentials_file).expanduser()
        if (not username or not password) and path.is_file():
            with path.open(encoding='utf-8') as stream:
                credentials = json.load(stream)
            username = username or credentials.get('username')
            password = password or credentials.get('password')
        if not username or not password:
            raise AssertionError('Set ECLAIM_USERNAME and ECLAIM_PASSWORD or configure the local credentials file')
        library = BuiltIn().get_library_instance('SeleniumLibrary')
        library.input_text('id:txtUserName', username)
        library.input_password('id:txtPassWord', password)
