import { Descriptions, Drawer, Tag, Typography } from "antd";

import type { IDocument } from "@/services/types/document";
import { DOCUMENT_STATUS } from "@/services/types/document";
import { DocumentAttachments } from "./document-attachments";

const { Text } = Typography;

interface IDocumentDetailProps {
  document?: IDocument;
  open: boolean;
  loading?: boolean;
  onClose: () => void;
}

export const DocumentDetail = ({
  document,
  open,
  loading,
  onClose,
}: IDocumentDetailProps) => {
  return (
    <Drawer
      title="文档详情"
      open={open}
      onClose={onClose}
      width={640}
      loading={loading}
    >
      {document && (
        <div className="space-y-6">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="标题">{document.title}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag
                color={
                  document.status === DOCUMENT_STATUS.PUBLISHED
                    ? "green"
                    : "default"
                }
              >
                {document.status === DOCUMENT_STATUS.PUBLISHED
                  ? "已发布"
                  : "草稿"}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="所有者">
              {document.owner.displayName}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {new Date(document.updatedAt).toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="正文">
              <Text className="whitespace-pre-wrap">{document.content}</Text>
            </Descriptions.Item>
          </Descriptions>

          <div>
            <Typography.Title level={5}>附件</Typography.Title>
            <DocumentAttachments
              documentId={document.id}
              attachments={document.attachments}
            />
          </div>
        </div>
      )}
    </Drawer>
  );
};
