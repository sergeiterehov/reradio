import { Alert, Link } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { TbBrandChrome } from "react-icons/tb";

export function ChromeOnly() {
  const { t } = useTranslation();

  if (navigator.serial) return null;

  return (
    <Alert.Root title="Incompatible Browser" status="error" borderRadius="none">
      <Alert.Indicator>
        <TbBrandChrome />
      </Alert.Indicator>
      <Alert.Content color="fg">
        <Alert.Title>{t("chrome_required_title")}</Alert.Title>
        <Alert.Description>{t("chrome_required_body")}</Alert.Description>
      </Alert.Content>
      <Link
        alignSelf="center"
        fontWeight="medium"
        href="https://www.google.com/chrome/"
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("download_chrome")}
      </Link>
    </Alert.Root>
  );
}
