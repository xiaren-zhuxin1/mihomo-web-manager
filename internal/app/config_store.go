package app

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"gopkg.in/yaml.v3"
)

type configStore struct {
	configPath string
	backupDir  string
}

func newConfigStore(configPath, backupDir string) *configStore {
	return &configStore{configPath: configPath, backupDir: backupDir}
}

func (cs *configStore) Read() (*yaml.Node, error) {
	data, err := os.ReadFile(cs.configPath)
	if err != nil {
		return nil, err
	}
	var doc yaml.Node
	if err := yaml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}
	if len(doc.Content) == 0 {
		doc.Kind = yaml.DocumentNode
		doc.Content = []*yaml.Node{{Kind: yaml.MappingNode}}
	}
	return doc.Content[0], nil
}

func (cs *configStore) Write(root *yaml.Node) error {
	if _, err := cs.Backup(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	doc := yaml.Node{Kind: yaml.DocumentNode, Content: []*yaml.Node{root}}
	data, err := yaml.Marshal(&doc)
	if err != nil {
		return err
	}
	return os.WriteFile(cs.configPath, data, 0o640)
}

func (cs *configStore) ReadRaw() (string, error) {
	data, err := os.ReadFile(cs.configPath)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (cs *configStore) WriteRaw(content string) error {
	if _, err := cs.Backup(); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	return os.WriteFile(cs.configPath, []byte(content), 0o640)
}

func (cs *configStore) Backup() (string, error) {
	data, err := os.ReadFile(cs.configPath)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(cs.backupDir, 0o750); err != nil {
		return "", err
	}
	name := fmt.Sprintf("config-%s.yaml", time.Now().Format("20060102-150405"))
	path := filepath.Join(cs.backupDir, name)
	return path, os.WriteFile(path, data, 0o640)
}

type ConfigBackupInfo struct {
	Name       string    `json:"name"`
	Path       string    `json:"path"`
	Size       int64     `json:"size"`
	ModifiedAt time.Time `json:"modifiedAt"`
}

func (cs *configStore) ListBackups() ([]ConfigBackupInfo, error) {
	entries, err := os.ReadDir(cs.backupDir)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return []ConfigBackupInfo{}, nil
		}
		return nil, err
	}
	backups := make([]ConfigBackupInfo, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() || !stringsHasSuffix(entry.Name(), ".yaml") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		backups = append(backups, ConfigBackupInfo{
			Name:       entry.Name(),
			Path:       filepath.Join(cs.backupDir, entry.Name()),
			Size:       info.Size(),
			ModifiedAt: info.ModTime(),
		})
	}
	sort.Slice(backups, func(i, j int) bool {
		return backups[i].ModifiedAt.After(backups[j].ModifiedAt)
	})
	return backups, nil
}

func (cs *configStore) ReadBackup(name string) (string, error) {
	if !cs.validBackupName(name) {
		return "", fmt.Errorf("invalid backup name")
	}
	data, err := os.ReadFile(filepath.Join(cs.backupDir, name))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (cs *configStore) RestoreBackup(name string) error {
	content, err := cs.ReadBackup(name)
	if err != nil {
		return err
	}
	return cs.WriteRaw(content)
}

func (cs *configStore) validBackupName(name string) bool {
	return name != "" && name == filepath.Base(name) && stringsHasSuffix(name, ".yaml")
}

func stringsHasSuffix(s, suffix string) bool {
	return len(s) >= len(suffix) && s[len(s)-len(suffix):] == suffix
}
