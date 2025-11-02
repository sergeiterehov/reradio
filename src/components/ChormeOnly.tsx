import { Alert, Link } from "@chakra-ui/react";
import { TbBrandChrome } from "react-icons/tb";

export function ChromeOnly() {
  if (navigator.serial) return null;

  return (
    <Alert.Root title="Incompatible Browser" status="error" borderRadius="none">
      <Alert.Indicator>
        <TbBrandChrome />
      </Alert.Indicator>
      <Alert.Content color="fg">
        <Alert.Title>Google Chrome Required</Alert.Title>
        <Alert.Description>
          This application uses the Web Serial API, which is currently only supported in Google Chrome.
        </Alert.Description>
      </Alert.Content>
      <Link
        alignSelf="center"
        fontWeight="medium"
        href="https://www.google.com/chrome/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Download Google Chrome
      </Link>
    </Alert.Root>
  );
}
