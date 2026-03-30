import { useState } from "react";
import {
  Page,
  Card,
  TextContainer,
  Button,
  FormLayout,
} from "@shopify/polaris";

const AppSettings = () => {
  const [enabled, setEnabled] = useState(true);
``
  const toggleAppStatus = () => {
    setEnabled((prevState) => !prevState);

  };

  return (
    <Page title="App Settings" fullWidth>
      <div className="mb-8 px-6 py-4 bg-white shadow-md rounded-lg">
        <Card sectioned>
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">
            PDF Converter App Settings
          </h2>
          <p className="text-gray-600">
            This app allows you to upload PDF files, convert them into
            high-quality images, and enable a point-based system for cart
            functionality. You can toggle the app on/off below.
          </p>
        </Card>
      </div>

      {/* <div className="mb-8 px-6 py-4 bg-white shadow-md rounded-lg">
        <Card title="App Status" sectioned>
          <TextContainer>
            <p className="text-lg font-medium text-gray-800">
              <strong>{enabled ? "App is Enabled" : "App is Disabled"}</strong>
            </p>
            <p className="text-gray-600">
              {enabled
                ? "The PDF-to-image conversion and point system are active."
                : "The PDF-to-image conversion and point system are inactive."}
            </p>
          </TextContainer>
          <FormLayout>
            <Button
              primary
              onClick={toggleAppStatus}
              className="mt-4 py-2 px-6 text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-md"
            >
              {enabled ? "Disable App" : "Enable App"}
            </Button>
          </FormLayout>
        </Card>
      </div> */}

      {/* <div className="mb-8 px-6 py-4 bg-white shadow-md rounded-lg">
        <Card sectioned>
          <Button
            primary
            onClick={() => alert("Settings have been saved!")}
            className="py-2 px-6 text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-md"
          >
            Save Settings
          </Button>
        </Card>
      </div> */}
    </Page>
  );
};

export default AppSettings;
