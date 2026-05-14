package app

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type MihomoClient struct {
	controllerURL string
	secret        string
	httpClient    *http.Client
	streamClient  *http.Client
}

func NewMihomoClient(controllerURL, secret string) *MihomoClient {
	if !strings.HasPrefix(controllerURL, "http://") && !strings.HasPrefix(controllerURL, "https://") {
		controllerURL = "http://" + controllerURL
	}
	return &MihomoClient{
		controllerURL: strings.TrimRight(controllerURL, "/"),
		secret:        secret,
		httpClient:    &http.Client{Timeout: 30 * time.Second},
		streamClient:  &http.Client{Timeout: 0},
	}
}

func (c *MihomoClient) Get(path string) (int, string, error) {
	return c.Do("GET", path, nil)
}

func (c *MihomoClient) Put(path string, body io.Reader) (int, string, error) {
	return c.Do("PUT", path, body)
}

func (c *MihomoClient) Patch(path string, body io.Reader) (int, string, error) {
	return c.Do("PATCH", path, body)
}

func (c *MihomoClient) Post(path string, body io.Reader) (int, string, error) {
	return c.Do("POST", path, body)
}

func (c *MihomoClient) Delete(path string) (int, string, error) {
	return c.Do("DELETE", path, nil)
}

func (c *MihomoClient) Do(method, path string, body io.Reader) (int, string, error) {
	url := c.controllerURL + path
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return 0, "", err
	}
	req.Header.Set("Content-Type", "application/json")
	if c.secret != "" {
		req.Header.Set("Authorization", "Bearer "+c.secret)
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return resp.StatusCode, "", err
	}
	return resp.StatusCode, string(data), nil
}

func (c *MihomoClient) DoJSON(method, path string, body io.Reader, result any) (int, error) {
	status, data, err := c.Do(method, path, body)
	if err != nil {
		return status, err
	}
	if result != nil {
		if err := json.Unmarshal([]byte(data), result); err != nil {
			return status, fmt.Errorf("parse response failed: %w", err)
		}
	}
	return status, nil
}

func (c *MihomoClient) Reload() (int, string, error) {
	return c.Put("/configs?force=true", strings.NewReader(`{}`))
}

func (c *MihomoClient) ReloadWithRetry(maxRetries int, delay time.Duration) (int, string, error) {
	var lastStatus int
	var lastBody string
	var lastErr error
	for i := 0; i <= maxRetries; i++ {
		status, body, err := c.Reload()
		lastStatus, lastBody, lastErr = status, body, err
		if err == nil && status < 300 {
			return status, body, nil
		}
		if i < maxRetries {
			time.Sleep(delay)
		}
	}
	return lastStatus, lastBody, lastErr
}

func (c *MihomoClient) SwitchProxy(group, proxy string) error {
	body := fmt.Sprintf(`{"name":"%s"}`, proxy)
	status, respBody, err := c.Put("/proxies/"+pathEscape(group), strings.NewReader(body))
	if err != nil {
		return err
	}
	if status != 204 && status != 200 {
		return fmt.Errorf("switch proxy failed: status %d, body: %s", status, truncate(respBody, 200))
	}
	return nil
}

func (c *MihomoClient) GetCurrentProxy(group string) (string, error) {
	var result struct {
		Now string `json:"now"`
	}
	_, err := c.DoJSON("GET", "/proxies/"+pathEscape(group), nil, &result)
	if err != nil {
		return "", err
	}
	return result.Now, nil
}

func (c *MihomoClient) GetProxies() (map[string]MihomoProxyEntry, error) {
	var resp MihomoProxiesResponse
	_, err := c.DoJSON("GET", "/proxies", nil, &resp)
	if err != nil {
		return nil, err
	}
	return resp.Proxies, nil
}

func (c *MihomoClient) GetProviders() (map[string]MihomoProviderEntry, error) {
	var resp struct {
		Providers map[string]MihomoProviderEntry `json:"providers"`
	}
	_, err := c.DoJSON("GET", "/providers/proxies", nil, &resp)
	if err != nil {
		return nil, err
	}
	return resp.Providers, nil
}

func (c *MihomoClient) UpdateProvider(providerName string) error {
	status, body, err := c.Put("/providers/proxies/"+pathEscape(providerName), strings.NewReader(`{}`))
	if err != nil {
		return err
	}
	if status >= 300 {
		return fmt.Errorf("provider update failed: %s", body)
	}
	return nil
}

type MihomoProxiesResponse struct {
	Proxies map[string]MihomoProxyEntry `json:"proxies"`
}

type MihomoProxyEntry struct {
	Name string   `json:"name"`
	Type string   `json:"type"`
	Now  string   `json:"now"`
	All  []string `json:"all"`
}

type MihomoProviderEntry struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Vehicle  string `json:"vehicleType"`
	TestURL  string `json:"testUrl"`
	Proxies  []struct {
		Name string `json:"name"`
	} `json:"proxies"`
}

func (c *MihomoClient) NewStreamRequest(method, path string) (*http.Request, error) {
	url := c.controllerURL + path
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		return nil, err
	}
	if c.secret != "" {
		req.Header.Set("Authorization", "Bearer "+c.secret)
	}
	return req, nil
}

func (c *MihomoClient) DoStream(req *http.Request) (*http.Response, error) {
	return c.streamClient.Do(req)
}

func pathEscape(s string) string {
	return strings.ReplaceAll(s, " ", "%20")
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
