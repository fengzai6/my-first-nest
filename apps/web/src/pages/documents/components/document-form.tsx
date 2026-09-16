import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Form, Input, Select, Space } from "antd";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { AttachmentUpload } from "@/components/attachment-upload";
import { GetDocumentAttachmentSignedUrl } from "@/services/api/document";
import type {
  ICreateDocumentDto,
  IUpdateDocumentDto,
} from "@/services/dtos/document";
import type { IAttachment } from "@/services/types/attachment";
import { DOCUMENT_STATUS, type IDocument } from "@/services/types/document";

const documentSchema = z.object({
  title: z.string().min(1, "请输入文档标题").max(200, "标题不能超过200个字符"),
  content: z.string().min(1, "请输入文档正文"),
  status: z.enum([DOCUMENT_STATUS.DRAFT, DOCUMENT_STATUS.PUBLISHED]),
  attachments: z.array(z.custom<IAttachment>()),
});

type IDocumentFormValues = z.infer<typeof documentSchema>;

interface IDocumentFormProps {
  mode: "create" | "edit";
  document?: IDocument;
  loading?: boolean;
  onSubmit: (data: ICreateDocumentDto | IUpdateDocumentDto) => void;
  onCancel: () => void;
}

export const DocumentForm = ({
  mode,
  document,
  loading = false,
  onSubmit,
  onCancel,
}: IDocumentFormProps) => {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<IDocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: document?.title ?? "",
      content: document?.content ?? "",
      status: document?.status ?? DOCUMENT_STATUS.DRAFT,
      attachments: document?.attachments ?? [],
    },
  });

  const handleFormSubmit = (values: IDocumentFormValues) => {
    onSubmit({
      title: values.title,
      content: values.content,
      status: values.status,
      attachmentIds: values.attachments.map((attachment) => attachment.id),
    });
  };

  return (
    <Form layout="vertical" onFinish={handleSubmit(handleFormSubmit)}>
      <Form.Item
        label="标题"
        validateStatus={errors.title ? "error" : ""}
        help={errors.title?.message}
        required
      >
        <Controller
          name="title"
          control={control}
          render={({ field }) => (
            <Input
              {...field}
              placeholder="请输入文档标题"
              maxLength={200}
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      <Form.Item
        label="正文"
        validateStatus={errors.content ? "error" : ""}
        help={errors.content?.message}
        required
      >
        <Controller
          name="content"
          control={control}
          render={({ field }) => (
            <Input.TextArea
              {...field}
              placeholder="请输入文档正文"
              rows={6}
              disabled={loading}
            />
          )}
        />
      </Form.Item>

      <Form.Item label="状态" required>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              {...field}
              disabled={loading}
              options={[
                { value: DOCUMENT_STATUS.DRAFT, label: "草稿" },
                { value: DOCUMENT_STATUS.PUBLISHED, label: "已发布" },
              ]}
            />
          )}
        />
      </Form.Item>

      <Form.Item label="附件">
        <Controller
          name="attachments"
          control={control}
          render={({ field }) => (
            <AttachmentUpload
              value={field.value}
              onChange={field.onChange}
              disabled={loading}
              getSignedUrl={
                document
                  ? (attachmentId) =>
                      GetDocumentAttachmentSignedUrl(document.id, attachmentId)
                  : undefined
              }
            />
          )}
        />
      </Form.Item>

      <Form.Item className="mt-6 mb-0">
        <Space className="w-full justify-end">
          <Button onClick={onCancel} disabled={loading}>
            取消
          </Button>
          <Button type="primary" htmlType="submit" loading={loading}>
            {mode === "create" ? "创建" : "保存"}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
};
