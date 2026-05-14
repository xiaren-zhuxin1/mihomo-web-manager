package app

import "gopkg.in/yaml.v3"

func scalar(value string) *yaml.Node {
	return &yaml.Node{Kind: yaml.ScalarNode, Value: value}
}

func mappingValue(root *yaml.Node, key string) *yaml.Node {
	if root == nil || root.Kind != yaml.MappingNode {
		return nil
	}
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == key {
			return root.Content[i+1]
		}
	}
	return nil
}

func ensureMapping(root *yaml.Node, key string) *yaml.Node {
	if root.Kind != yaml.MappingNode {
		root.Kind = yaml.MappingNode
		root.Content = nil
	}
	if node := mappingValue(root, key); node != nil {
		if node.Kind != yaml.MappingNode {
			node.Kind = yaml.MappingNode
			node.Content = nil
		}
		return node
	}
	value := &yaml.Node{Kind: yaml.MappingNode}
	root.Content = append(root.Content, scalar(key), value)
	return value
}

func ensureSequence(root *yaml.Node, key string) *yaml.Node {
	if root.Kind != yaml.MappingNode {
		root.Kind = yaml.MappingNode
		root.Content = nil
	}
	if node := mappingValue(root, key); node != nil {
		if node.Kind != yaml.SequenceNode {
			node.Kind = yaml.SequenceNode
			node.Content = nil
		}
		return node
	}
	value := &yaml.Node{Kind: yaml.SequenceNode}
	root.Content = append(root.Content, scalar(key), value)
	return value
}

func childScalar(node *yaml.Node, key string) string {
	if node == nil || node.Kind != yaml.MappingNode {
		return ""
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key {
			if node.Content[i+1].Kind == yaml.ScalarNode {
				return node.Content[i+1].Value
			}
			return ""
		}
	}
	return ""
}

func childScalars(node *yaml.Node, key string) []string {
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}
	child := mappingValue(node, key)
	if child == nil || child.Kind != yaml.SequenceNode {
		return nil
	}
	items := make([]string, 0, len(child.Content))
	for _, item := range child.Content {
		items = append(items, item.Value)
	}
	return items
}

func removeMappingKey(root *yaml.Node, key string) {
	if root == nil || root.Kind != yaml.MappingNode {
		return
	}
	next := root.Content[:0]
	for i := 0; i+1 < len(root.Content); i += 2 {
		if root.Content[i].Value == key {
			continue
		}
		next = append(next, root.Content[i], root.Content[i+1])
	}
	root.Content = next
}

func setChildScalar(node *yaml.Node, key, value string) {
	if node == nil || node.Kind != yaml.MappingNode {
		return
	}
	for i := 0; i+1 < len(node.Content); i += 2 {
		if node.Content[i].Value == key {
			node.Content[i+1].Value = value
			return
		}
	}
	node.Content = append(node.Content, scalar(key), scalar(value))
}
