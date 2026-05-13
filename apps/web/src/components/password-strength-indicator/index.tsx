interface IPasswordStrengthIndicatorProps {
  password: string;
}

export const PasswordStrengthIndicator: React.FC<
  IPasswordStrengthIndicatorProps
> = ({ password }) => {
  if (!password) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 text-sm text-gray-600">密码强度：</div>
      <div className="flex gap-1">
        <div
          className={`h-2 flex-1 rounded ${
            password.length >= 6 ? "bg-red-400" : "bg-gray-200"
          }`}
        />
        <div
          className={`h-2 flex-1 rounded ${
            password.length >= 8 && /[A-Z]/.test(password)
              ? "bg-yellow-400"
              : "bg-gray-200"
          }`}
        />
        <div
          className={`h-2 flex-1 rounded ${
            password.length >= 8 &&
            /[A-Z]/.test(password) &&
            /[0-9]/.test(password) &&
            /[^A-Za-z0-9]/.test(password)
              ? "bg-green-400"
              : "bg-gray-200"
          }`}
        />
      </div>
      <div className="mt-1 text-xs text-gray-500">
        建议：至少8位，包含大小写字母、数字和特殊字符
      </div>
    </div>
  );
};
